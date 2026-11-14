import { createClient } from "@supabase/supabase-js";
import { DEMO, FN, SB_KLJUC, SB_URL } from "./config";
import { izDana, uDan, type Vrsta } from "../supabase/functions/parastosi/pomeni.ts";

export const sb = createClient(SB_URL, SB_KLJUC, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export interface Pokojnik {
  id: string;
  ime_prezime: string;
  datum_smrti: string | null;
  datum_sahrane: string | null;
  godina_rodjenja: number | null;
  mesto_sahrane: string | null;
  kremacija: boolean;
  kontakt_ime: string | null;
  kontakt_telefon: string | null;
  whatsapp: boolean;
  napomena: string | null;
  izvor: "rucno" | "uvoz" | "link";
  novo: boolean;
  za_proveru: boolean;
  created_at: string;
}
export type PokojnikUnos = Omit<Pokojnik, "id" | "created_at" | "izvor" | "novo">;

export interface Stanje {
  pokojnik_id: string;
  vrsta: Vrsta;
  obavljeno: boolean;
  obavesten_u: string | null;
}
export interface Podesavanja {
  dana_unapred: number;
  cas_slanja: number;
  dana_40: number;
}
export interface Link {
  id: string;
  token: string;
  naziv: string | null;
  jezik: "sr" | "fr";
  jednokratan: boolean;
  broj_prijava: number;
  istice: string;
  opozvan: boolean;
  created_at: string;
}
export interface Podaci {
  pokojnici: Pokojnik[];
  stanja: Stanje[];
  pod: Podesavanja;
}

const KES = "parastosi-podaci-v1";
const POLJA =
  "id, ime_prezime, datum_smrti, datum_sahrane, godina_rodjenja, mesto_sahrane, kremacija, " +
  "kontakt_ime, kontakt_telefon, whatsapp, napomena, izvor, novo, za_proveru, created_at";

export function izKesa(): Podaci | null {
  if (DEMO) return demoPodaci();
  try {
    const s = localStorage.getItem(KES);
    return s ? (JSON.parse(s) as Podaci) : null;
  } catch {
    return null;
  }
}

export function obrisiKes() {
  try {
    localStorage.removeItem(KES);
  } catch {
    /* није битно */
  }
}

function greska(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

export async function ucitaj(): Promise<Podaci> {
  if (DEMO) return demoPodaci();
  const [a, b, c] = await Promise.all([
    sb.from("pokojnici").select(POLJA).order("datum_smrti", { ascending: false, nullsFirst: false }),
    sb.from("pomen_stanje").select("pokojnik_id, vrsta, obavljeno, obavesten_u"),
    sb.from("podesavanja").select("dana_unapred, cas_slanja, dana_40").eq("id", 1).single(),
  ]);
  greska(a.error);
  greska(b.error);
  greska(c.error);
  const podaci: Podaci = {
    pokojnici: (a.data ?? []) as unknown as Pokojnik[],
    stanja: (b.data ?? []) as Stanje[],
    pod: c.data as Podesavanja,
  };
  try {
    localStorage.setItem(KES, JSON.stringify(podaci));
  } catch {
    /* кеш је само погодност */
  }
  return podaci;
}

export async function sacuvajPokojnika(id: string | null, p: PokojnikUnos): Promise<string> {
  if (DEMO) return id ?? "demo";
  if (id) {
    const { error } = await sb.from("pokojnici").update(p).eq("id", id);
    greska(error);
    return id;
  }
  const { data, error } = await sb.from("pokojnici").insert({ ...p, izvor: "rucno" }).select("id").single();
  greska(error);
  return (data as { id: string }).id;
}

export async function obrisiPokojnika(id: string) {
  if (DEMO) return;
  const { error } = await sb.from("pokojnici").delete().eq("id", id);
  greska(error);
}

export async function oznaciVidjeno(id: string) {
  if (DEMO) return;
  const { error } = await sb.from("pokojnici").update({ novo: false }).eq("id", id);
  greska(error);
}

export async function postaviObavljeno(pokojnik_id: string, vrsta: Vrsta, obavljeno: boolean) {
  if (DEMO) return;
  const { error } = await sb
    .from("pomen_stanje")
    .upsert({ pokojnik_id, vrsta, obavljeno }, { onConflict: "pokojnik_id,vrsta" });
  greska(error);
}

export async function sacuvajPodesavanja(p: Partial<Podesavanja>) {
  if (DEMO) return;
  const { error } = await sb.from("podesavanja").update(p).eq("id", 1);
  greska(error);
}

export async function ucitajLinkove(): Promise<Link[]> {
  if (DEMO) return [];
  const { data, error } = await sb.from("linkovi").select("*").order("created_at", { ascending: false });
  greska(error);
  return (data ?? []) as Link[];
}

export async function napraviLink(l: { token: string; naziv: string | null; jezik: "sr" | "fr"; jednokratan: boolean }) {
  if (DEMO) return;
  const { error } = await sb.from("linkovi").insert(l);
  greska(error);
}

export async function opozoviLink(id: string) {
  if (DEMO) return;
  const { error } = await sb.from("linkovi").update({ opozvan: true }).eq("id", id);
  greska(error);
}

/** Позив серверске функције. */
export async function fn<T>(r: string, opcije: { telo?: unknown; upit?: string; saPrijavom?: boolean } = {}): Promise<T> {
  const zaglavlja: Record<string, string> = { "Content-Type": "application/json" };
  if (opcije.saPrijavom) {
    const { data } = await sb.auth.getSession();
    if (data.session) zaglavlja.Authorization = `Bearer ${data.session.access_token}`;
  }
  const odg = await fetch(`${FN}?r=${r}${opcije.upit ? "&" + opcije.upit : ""}`, {
    method: opcije.telo === undefined ? "GET" : "POST",
    headers: zaglavlja,
    body: opcije.telo === undefined ? undefined : JSON.stringify(opcije.telo),
  });
  return (await odg.json()) as T;
}

// ------------------------------------------------------- измишљени подаци (само у развоју)
function demoPodaci(): Podaci {
  const danas = uDan(new Date().toISOString().slice(0, 10));
  const pre = (n: number) => izDana(danas - n);
  const red = (i: number, ime: string, smrt: string | null, vise: Partial<Pokojnik> = {}): Pokojnik => ({
    id: `d${i}`, ime_prezime: ime, datum_smrti: smrt, datum_sahrane: null, godina_rodjenja: null,
    mesto_sahrane: null, kremacija: false, kontakt_ime: null, kontakt_telefon: null, whatsapp: false,
    napomena: null, izvor: "uvoz", novo: false, za_proveru: false, created_at: new Date().toISOString(), ...vise,
  });
  return {
    pokojnici: [
      red(1, "Милутин Тестовић", pre(39), { mesto_sahrane: "Thiais", kontakt_ime: "Ана Тестовић", kontakt_telefon: "06 00 00 00 01", whatsapp: true }),
      red(2, "Десанка Примерић", pre(181), { mesto_sahrane: "Pantin", kontakt_telefon: "06 00 00 00 02" }),
      red(3, "Радован Узорковић", pre(361), { mesto_sahrane: "Père-Lachaise", godina_rodjenja: 1941 }),
      red(4, "Stanislava Probić", pre(29), { mesto_sahrane: "Argenteuil", novo: true, izvor: "link", kontakt_ime: "Marc Probić", kontakt_telefon: "+33 6 00 00 00 03" }),
      red(5, "Живорад Огледовић", pre(150), { mesto_sahrane: "Saint-Denis" }),
      red(6, "Косара Макетић", pre(43), { kremacija: true, napomena: "Породица живи далеко." }),
      red(7, "Борисав Скицић", null, { datum_sahrane: pre(60), za_proveru: true }),
      red(8, "Латинка Нацртовић", pre(320), { mesto_sahrane: "Creil", kontakt_telefon: "06 00 00 00 04" }),
    ],
    stanja: [],
    pod: { dana_unapred: 14, cas_slanja: 8, dana_40: 40 },
  };
}
