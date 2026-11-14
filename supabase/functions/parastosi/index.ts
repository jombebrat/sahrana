// Парастоси – серверска функција.
//   ?r=stanje   GET   да ли је власник подешен
//   ?r=podesi   POST  прво подешавање: једнократни код + нова лозинка
//   ?r=link     GET   да ли линк за породицу важи
//   ?r=prijava  POST  породица шаље формулар
//   ?r=dnevno   POST  дневна провера помена (позива је распоред у бази)
//   ?r=proba    POST  пробно обавештење (само власник)
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import {
  casUParizu,
  danasUParizu,
  danUNedelji,
  datumPomena,
  formatDatum,
  jeDatum,
  NAZIV_VRSTE,
  uDan,
  type Vrsta,
  VRSTE,
  zaTekst,
} from "./pomeni.ts";

const SAJT = "https://jombebrat.github.io/sahrana/";
const EMAIL_VLASNIKA = "vlasnik@parastosi.invalid";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function odgovor(telo: unknown, status = 200): Response {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function tajne(): Promise<Record<string, string>> {
  const { data, error } = await sb.rpc("tajne");
  if (error) throw new Error("tajne: " + error.message);
  return data ?? {};
}

function isto(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const pauza = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ push
interface Poruka {
  title: string;
  body: string;
  url: string;
  tag: string;
}

async function posalji(poruka: Poruka) {
  const t = await tajne();
  const { data: pretplate } = await sb.from("push_pretplate").select("id, endpoint, p256dh, auth");
  let poslato = 0;
  const greske: string[] = [];
  for (const p of pretplate ?? []) {
    try {
      const d = webpush.generateRequestDetails(
        { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
        JSON.stringify(poruka),
        {
          vapidDetails: { subject: SAJT, publicKey: t.vapid_public, privateKey: t.vapid_private },
          TTL: 86400,
          urgency: "high",
        },
      );
      const zaglavlja: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.headers)) {
        if (k.toLowerCase() !== "content-length") zaglavlja[k] = String(v);
      }
      const r = await fetch(d.endpoint, { method: "POST", headers: zaglavlja, body: d.body });
      if (r.status === 404 || r.status === 410) {
        await sb.from("push_pretplate").delete().eq("id", p.id);
        greske.push(`претплата више не важи (${r.status})`);
      } else if (!r.ok) {
        greske.push(`${r.status} ${(await r.text()).slice(0, 200)}`);
      } else {
        poslato++;
      }
    } catch (e) {
      greske.push(String(e).slice(0, 200));
    }
  }
  return { poslato, ukupno: pretplate?.length ?? 0, greske };
}

// ------------------------------------------------------- дневна провера
async function dnevno(prisilno: boolean) {
  const { data: pod, error } = await sb.from("podesavanja").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  const danas = danasUParizu();
  if (!prisilno) {
    if (casUParizu() < pod.cas_slanja) return { preskoceno: "још није време" };
    if (pod.poslednje_slanje === danas) return { preskoceno: "данас је већ послато" };
  }

  const [{ data: pokojnici }, { data: stanja }] = await Promise.all([
    sb.from("pokojnici").select("id, ime_prezime, datum_smrti, mesto_sahrane").not("datum_smrti", "is", null),
    sb.from("pomen_stanje").select("pokojnik_id, vrsta, obavljeno, obavesten_u"),
  ]);
  const stanje = new Map((stanja ?? []).map((s) => [`${s.pokojnik_id}|${s.vrsta}`, s]));
  const d0 = uDan(danas);

  const stizu: { id: string; ime: string; mesto: string | null; vrsta: Vrsta; datum: string; za: number }[] = [];
  for (const p of pokojnici ?? []) {
    for (const vrsta of VRSTE) {
      const datum = datumPomena(p.datum_smrti, vrsta, pod.dana_40);
      const za = uDan(datum) - d0;
      const s = stanje.get(`${p.id}|${vrsta}`);
      if (za >= 0 && za <= pod.dana_unapred && !s?.obavljeno && !s?.obavesten_u) {
        stizu.push({ id: p.id, ime: p.ime_prezime, mesto: p.mesto_sahrane, vrsta, datum, za });
      }
    }
  }

  if (stizu.length === 0) {
    await sb.from("podesavanja").update({ poslednje_slanje: danas }).eq("id", 1);
    return { stizu: 0 };
  }
  stizu.sort((a, b) => a.za - b.za || a.ime.localeCompare(b.ime));

  let poruka: Poruka;
  if (stizu.length === 1) {
    const s = stizu[0];
    poruka = {
      title: `${NAZIV_VRSTE[s.vrsta]} – ${s.ime}`,
      body: `${danUNedelji(s.datum)} ${formatDatum(s.datum)}, ${zaTekst(s.za)}${s.mesto ? ", " + s.mesto : ""}`,
      url: `${SAJT}#/p/${s.id}`,
      tag: `pomen-${danas}`,
    };
  } else {
    poruka = {
      title: `${stizu.length} помена у наредних ${pod.dana_unapred} дана`,
      body: stizu
        .map((s) => `${formatDatum(s.datum).slice(0, 6)} ${NAZIV_VRSTE[s.vrsta]} – ${s.ime}`)
        .join("\n"),
      url: SAJT,
      tag: `pomen-${danas}`,
    };
  }

  const r = await posalji(poruka);
  if (r.poslato > 0) {
    const sada = new Date().toISOString();
    await sb.from("pomen_stanje").upsert(
      stizu.map((s) => ({ pokojnik_id: s.id, vrsta: s.vrsta, obavesten_u: sada })),
      { onConflict: "pokojnik_id,vrsta" },
    );
    await sb.from("podesavanja").update({ poslednje_slanje: danas }).eq("id", 1);
  }
  return { stizu: stizu.length, ...r };
}

// -------------------------------------------------------------- пријава
function tekst(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function prijava(telo: Record<string, unknown>) {
  const token = tekst(telo.t, 128);
  const p = (telo.podaci ?? {}) as Record<string, unknown>;
  const ime = tekst(p.ime_prezime, 160);
  const kontaktIme = tekst(p.kontakt_ime, 160);
  const telefon = tekst(p.kontakt_telefon, 40);
  const danas = danasUParizu();

  const polja: string[] = [];
  if (!ime) polja.push("ime_prezime");
  if (!jeDatum(p.datum_smrti) || p.datum_smrti > danas || p.datum_smrti < "1950-01-01") polja.push("datum_smrti");
  if (p.datum_sahrane && !jeDatum(p.datum_sahrane)) polja.push("datum_sahrane");
  const godina = p.godina_rodjenja === "" || p.godina_rodjenja == null ? null : Number(p.godina_rodjenja);
  if (godina !== null && (!Number.isInteger(godina) || godina < 1850 || godina > Number(danas.slice(0, 4)))) {
    polja.push("godina_rodjenja");
  }
  if (!kontaktIme) polja.push("kontakt_ime");
  if (telefon.replace(/\D/g, "").length < 6) polja.push("kontakt_telefon");
  if (polja.length) return odgovor({ ok: false, razlog: "polja", polja }, 400);

  const { data, error } = await sb.rpc("prijava_preko_linka", {
    p_token: token,
    p: {
      ime_prezime: ime,
      datum_smrti: p.datum_smrti,
      datum_sahrane: p.datum_sahrane || "",
      godina_rodjenja: godina === null ? "" : String(godina),
      mesto_sahrane: tekst(p.mesto_sahrane, 200),
      kremacija: p.kremacija === true,
      kontakt_ime: kontaktIme,
      kontakt_telefon: telefon,
      whatsapp: p.whatsapp === true,
      napomena: tekst(p.napomena, 2000),
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) return odgovor({ ok: false, razlog: "link" }, 410);

  try {
    await posalji({
      title: "Нова пријава од породице",
      body: `${ime}, преминуо/ла ${formatDatum(p.datum_smrti as string)}. Контакт: ${kontaktIme}`,
      url: `${SAJT}#/p/${data.id}`,
      tag: `prijava-${data.id}`,
    });
  } catch (e) {
    console.error("push после пријаве:", e);
  }
  return odgovor({ ok: true });
}

// ------------------------------------------------------ прво подешавање
async function podesi(telo: Record<string, unknown>) {
  const kod = tekst(telo.kod, 40).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const lozinka = typeof telo.lozinka === "string" ? telo.lozinka : "";
  if (lozinka.length < 8 || lozinka.length > 72) return odgovor({ ok: false, razlog: "lozinka" }, 400);

  const t = await tajne();
  const pravi = (t.setup_kod ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!pravi || !isto(kod, pravi)) {
    await pauza(1500);
    return odgovor({ ok: false, razlog: "kod" }, 403);
  }

  const { data, error } = await sb.auth.admin.createUser({
    email: EMAIL_VLASNIKA,
    password: lozinka,
    email_confirm: true,
  });
  if (error || !data.user) return odgovor({ ok: false, razlog: "nalog", detalj: error?.message }, 500);

  const { data: postavljen } = await sb.rpc("postavi_vlasnika", { p_vlasnik: data.user.id });
  if (!postavljen) {
    await sb.auth.admin.deleteUser(data.user.id);
    return odgovor({ ok: false, razlog: "vec" }, 409);
  }
  return odgovor({ ok: true });
}

async function jeVlasnik(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await sb.auth.getUser(jwt);
  if (!data?.user) return false;
  const { data: pod } = await sb.from("podesavanja").select("vlasnik").eq("id", 1).single();
  return !!pod?.vlasnik && pod.vlasnik === data.user.id;
}

// ------------------------------------------------------------------ улаз
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const r = url.searchParams.get("r");
  try {
    if (r === "stanje" && req.method === "GET") {
      const { data } = await sb.from("podesavanja").select("vlasnik").eq("id", 1).single();
      return odgovor({ podeseno: !!data?.vlasnik });
    }

    if (r === "link" && req.method === "GET") {
      const token = url.searchParams.get("t") ?? "";
      const { data: l } = await sb
        .from("linkovi")
        .select("jezik, jednokratan, broj_prijava, istice, opozvan")
        .eq("token", token)
        .maybeSingle();
      const vazi = !!l && !l.opozvan && new Date(l.istice) > new Date() &&
        !(l.jednokratan && l.broj_prijava >= 1) && l.broj_prijava < 50;
      return odgovor({ ok: vazi, jezik: vazi ? l.jezik : undefined });
    }

    if (req.method !== "POST") return odgovor({ greska: "непознат захтев" }, 404);
    const telo = await req.json().catch(() => ({}));

    if (r === "prijava") return await prijava(telo);
    if (r === "podesi") return await podesi(telo);

    if (r === "dnevno") {
      const t = await tajne();
      const tajna = req.headers.get("x-cron-secret") ?? "";
      if (!t.cron_secret || !isto(tajna, t.cron_secret)) return odgovor({ greska: "забрањено" }, 403);
      return odgovor(await dnevno(telo?.prisilno === true));
    }

    if (r === "proba") {
      if (!(await jeVlasnik(req))) return odgovor({ greska: "забрањено" }, 403);
      return odgovor(
        await posalji({
          title: "Парастоси",
          body: "Обавештења раде. Овако ће стизати подсетник 14 дана пре помена.",
          url: SAJT,
          tag: "proba",
        }),
      );
    }

    return odgovor({ greska: "непознат захтев" }, 404);
  } catch (e) {
    console.error(e);
    return odgovor({ greska: "грешка на серверу" }, 500);
  }
});
