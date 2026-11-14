import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import {
  danasUParizu,
  danUNedelji,
  formatDatum,
  MESECI_KRATKO,
  NAZIV_VRSTE,
  pomeniZa,
  type Pomen,
  type Vrsta,
  zaTekst,
} from "../supabase/functions/parastosi/pomeni.ts";
import { DEMO } from "./config";
import { izKesa, sb, ucitaj, type Podaci, type Pokojnik } from "./sb";
import { stanjeObavestenja, ukljuciObavestenja, type StanjeOb } from "./obavestenja";
import { dugDatum, zaPoziv, zaPretragu } from "./util";
import Detalj from "./Detalj";
import Formular from "./Formular";
import Linkovi from "./Linkovi";
import Podesavanja from "./Podesavanja";

export interface Dogadjaj extends Pomen {
  p: Pokojnik;
}
type Tab = "predstoji" | "svi" | "linkovi";
export type Filter = "svi" | "bez_datuma" | "novo" | "za_proveru";
type Sloj =
  | null
  | { tip: "detalj"; id: string }
  | { tip: "forma"; id: string | null }
  | { tip: "podesavanja" };

/** Листић календара: месец на траци у боји помена, дан крупно испод. */
export function Listic({ datum, vrsta }: { datum: string; vrsta: Vrsta }) {
  const [, m, d] = datum.split("-").map(Number);
  return (
    <span className={`listic v-${vrsta}`} aria-hidden="true">
      <span className="listic-mesec">{MESECI_KRATKO[m - 1]}</span>
      <span className="listic-dan">{d}</span>
    </span>
  );
}

export const IkonaTelefon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

const TABOVI: [Tab, string, JSX.Element][] = [
  [
    "predstoji",
    "Предстоји",
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10h17M8 3v3.5M16 3v3.5" />
    </>,
  ],
  [
    "svi",
    "Сви",
    <>
      <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" />
    </>,
  ],
  [
    "linkovi",
    "Линкови",
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>,
  ],
];

function useDanas(): string {
  const [danas, setDanas] = useState(() => danasUParizu());
  useEffect(() => {
    const t = setInterval(() => setDanas(danasUParizu()), 60000);
    return () => clearInterval(t);
  }, []);
  return danas;
}

export default function Glavni() {
  const [podaci, setPodaci] = useState<Podaci | null>(izKesa);
  const [upozorenje, setUpozorenje] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("predstoji");
  const [sloj, setSloj] = useState<Sloj>(null);
  const [filter, setFilter] = useState<Filter>("svi");
  const [stanjeOb, setStanjeOb] = useState<StanjeOb | null>(null);
  const danas = useDanas();

  const osvezi = useCallback(async () => {
    try {
      setPodaci(await ucitaj());
      setUpozorenje(null);
    } catch {
      setUpozorenje("Нема везе са сервером. Приказани су последњи сачувани подаци.");
    }
  }, []);

  useEffect(() => {
    osvezi();
    const naVidljivo = () => {
      if (document.visibilityState === "visible") osvezi();
    };
    document.addEventListener("visibilitychange", naVidljivo);
    window.addEventListener("online", osvezi);
    // Унос породице преко линка стиже одмах, без освежавања.
    const kanal = DEMO
      ? null
      : sb
          .channel("pokojnici")
          .on("postgres_changes", { event: "*", schema: "public", table: "pokojnici" }, () => osvezi())
          .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", naVidljivo);
      window.removeEventListener("online", osvezi);
      if (kanal) sb.removeChannel(kanal);
    };
  }, [osvezi]);

  // Додир на обавештење отвара запис: …/#/p/<id>
  useEffect(() => {
    const otvoriIz = (tekst: string) => {
      const m = tekst.match(/#\/p\/([\w-]+)/);
      if (m) {
        setSloj({ tip: "detalj", id: m[1] });
        history.replaceState(null, "", location.pathname + location.search);
      }
    };
    const naHash = () => otvoriIz(location.hash);
    const naPoruku = (e: MessageEvent) => {
      if (typeof e.data?.otvori === "string") otvoriIz(e.data.otvori);
    };
    naHash();
    window.addEventListener("hashchange", naHash);
    navigator.serviceWorker?.addEventListener("message", naPoruku);
    return () => {
      window.removeEventListener("hashchange", naHash);
      navigator.serviceWorker?.removeEventListener("message", naPoruku);
    };
  }, []);

  useEffect(() => {
    stanjeObavestenja()
      .then((s) => {
        setStanjeOb(s);
        // Претплата постоји на телефону: упиши је поново у базу ако је тамо нема.
        if (s === "ukljuceno" && !DEMO) ukljuciObavestenja().catch(() => {});
      })
      .catch(() => setStanjeOb("nepodrzano"));
  }, []);

  const dogadjaji = useMemo<Dogadjaj[]>(() => {
    if (!podaci) return [];
    const obavljeno = new Map<string, Partial<Record<Vrsta, boolean>>>();
    for (const s of podaci.stanja) {
      const o = obavljeno.get(s.pokojnik_id) ?? {};
      o[s.vrsta] = s.obavljeno;
      obavljeno.set(s.pokojnik_id, o);
    }
    const sve: Dogadjaj[] = [];
    for (const p of podaci.pokojnici) {
      if (!p.datum_smrti) continue;
      for (const pomen of pomeniZa(p.datum_smrti, danas, podaci.pod.dana_40, obavljeno.get(p.id))) {
        sve.push({ ...pomen, p });
      }
    }
    return sve.sort((a, b) => a.zaDana - b.zaDana || a.p.ime_prezime.localeCompare(b.p.ime_prezime));
  }, [podaci, danas]);

  const otvori = (id: string) => setSloj({ tip: "detalj", id });
  const idiNaSve = (f: Filter) => {
    setFilter(f);
    setTab("svi");
  };

  return (
    <div className="app">
      <header className="zaglavlje">
        <div>
          <h1>Парастоси</h1>
          <p>
            {danUNedelji(danas)}, {dugDatum(danas)}
          </p>
        </div>
        <button className="krug staklo" aria-label="Подешавања" onClick={() => setSloj({ tip: "podesavanja" })}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </header>

      {upozorenje && <p className="traka traka-siva">{upozorenje}</p>}

      <main>
        {!podaci ? (
          <p className="tiho pad">Учитавање…</p>
        ) : tab === "predstoji" ? (
          <Predstoji
            dogadjaji={dogadjaji}
            pokojnici={podaci.pokojnici}
            stanjeOb={stanjeOb}
            otvori={otvori}
            idiNaSve={idiNaSve}
            otvoriPodesavanja={() => setSloj({ tip: "podesavanja" })}
          />
        ) : tab === "svi" ? (
          <Svi
            pokojnici={podaci.pokojnici}
            dogadjaji={dogadjaji}
            filter={filter}
            setFilter={setFilter}
            otvori={otvori}
          />
        ) : (
          <Linkovi />
        )}
      </main>

      <div className="dno">
        <nav className="tabovi staklo" aria-label="Главни мени">
          {TABOVI.map(([t, naziv, ikona]) => (
            <button key={t} className={tab === t ? "aktivan" : ""} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ikona}
              </svg>
              {naziv}
            </button>
          ))}
        </nav>
        <button className="plus staklo" aria-label="Нови унос" onClick={() => setSloj({ tip: "forma", id: null })}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {sloj?.tip === "detalj" && podaci && (
        <Detalj
          pokojnik={podaci.pokojnici.find((p) => p.id === sloj.id) ?? null}
          pomeni={dogadjaji.filter((d) => d.p.id === sloj.id).sort((a, b) => (a.datum < b.datum ? -1 : 1))}
          zatvori={() => setSloj(null)}
          izmeni={() => setSloj({ tip: "forma", id: sloj.id })}
          osvezi={osvezi}
        />
      )}
      {sloj?.tip === "forma" && podaci && (
        <Formular
          pokojnik={sloj.id ? (podaci.pokojnici.find((p) => p.id === sloj.id) ?? null) : null}
          dana40={podaci.pod.dana_40}
          zatvori={() => setSloj(sloj.id ? { tip: "detalj", id: sloj.id } : null)}
          sacuvano={async (id) => {
            await osvezi();
            setSloj({ tip: "detalj", id });
          }}
        />
      )}
      {sloj?.tip === "podesavanja" && podaci && (
        <Podesavanja
          podaci={podaci}
          stanjeOb={stanjeOb}
          setStanjeOb={setStanjeOb}
          zatvori={() => setSloj(null)}
          osvezi={osvezi}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Предстоји
function RedPomena({ d, otvori }: { d: Dogadjaj; otvori: (id: string) => void }) {
  const tel = d.p.kontakt_telefon;
  return (
    <li className={`red${d.obavljeno ? " obavljen" : ""}`}>
      <button className="red-glavno" onClick={() => otvori(d.p.id)}>
        <Listic datum={d.datum} vrsta={d.vrsta} />
        <span className="red-tekst">
          <span className="ime">{d.p.ime_prezime}</span>
          <span className="opis">
            <span className={`vrsta v-${d.vrsta}`}>{NAZIV_VRSTE[d.vrsta]}</span>
            <span>{d.obavljeno ? "обављено" : zaTekst(d.zaDana)}</span>
          </span>
          {(d.p.mesto_sahrane || d.p.kremacija) && (
            <span className="mesto">{d.p.mesto_sahrane ?? "кремација"}</span>
          )}
        </span>
      </button>
      {tel && (
        <a className="pozovi" href={`tel:${zaPoziv(tel)}`} aria-label={`Позови: ${d.p.kontakt_ime ?? tel}`}>
          <IkonaTelefon />
        </a>
      )}
    </li>
  );
}

function Predstoji(props: {
  dogadjaji: Dogadjaj[];
  pokojnici: Pokojnik[];
  stanjeOb: StanjeOb | null;
  otvori: (id: string) => void;
  idiNaSve: (f: Filter) => void;
  otvoriPodesavanja: () => void;
}) {
  const { dogadjaji, pokojnici, stanjeOb, otvori, idiNaSve, otvoriPodesavanja } = props;
  const novih = pokojnici.filter((p) => p.novo).length;
  const bezDatuma = pokojnici.filter((p) => !p.datum_smrti).length;
  const skoroProslo = dogadjaji.filter((d) => d.status === "skoro_proslo").reverse();
  const grupe = [
    { naslov: "Ове недеље", od: 0, doDana: 7 },
    { naslov: "Наредних 14 дана", od: 8, doDana: 14 },
    { naslov: "До 60 дана", od: 15, doDana: 60 },
  ].map((g) => ({ ...g, stavke: dogadjaji.filter((d) => d.zaDana >= g.od && d.zaDana <= g.doDana) }));
  const ukupno = grupe.reduce((n, g) => n + g.stavke.length, 0);

  return (
    <>
      {stanjeOb && stanjeOb !== "ukljuceno" && (
        <button className="traka traka-crvena" onClick={otvoriPodesavanja}>
          Обавештења нису укључена. Додирни да их укључиш.
        </button>
      )}
      {novih > 0 && (
        <button className="traka traka-plava" onClick={() => idiNaSve("novo")}>
          {novih === 1 ? "1 нов унос од породице" : novih < 5 ? `${novih} нова уноса од породице` : `${novih} нових уноса од породице`}
        </button>
      )}

      {skoroProslo.length > 0 && (
        <section>
          <h2>
            Скоро прошло <span className="broj">{skoroProslo.length}</span>
          </h2>
          <ul className="lista">
            {skoroProslo.map((d) => (
              <RedPomena key={d.p.id + d.vrsta} d={d} otvori={otvori} />
            ))}
          </ul>
        </section>
      )}

      {grupe.map(
        (g) =>
          g.stavke.length > 0 && (
            <section key={g.naslov}>
              <h2>
                {g.naslov} <span className="broj">{g.stavke.length}</span>
              </h2>
              <ul className="lista">
                {g.stavke.map((d) => (
                  <RedPomena key={d.p.id + d.vrsta} d={d} otvori={otvori} />
                ))}
              </ul>
            </section>
          ),
      )}

      {ukupno === 0 && <p className="tiho pad">У наредних 60 дана нема помена.</p>}

      {bezDatuma > 0 && (
        <button className="traka traka-siva" onClick={() => idiNaSve("bez_datuma")}>
          {bezDatuma} без датума смрти: за њих се помени не рачунају. Допуни датум.
        </button>
      )}
    </>
  );
}

// ------------------------------------------------------------------------ Сви
function Svi(props: {
  pokojnici: Pokojnik[];
  dogadjaji: Dogadjaj[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  otvori: (id: string) => void;
}) {
  const { pokojnici, dogadjaji, filter, setFilter, otvori } = props;
  const [upit, setUpit] = useState("");

  const sledeci = useMemo(() => {
    const m = new Map<string, Dogadjaj>();
    for (const d of dogadjaji) {
      if (d.zaDana >= 0 && !d.obavljeno && !m.has(d.p.id)) m.set(d.p.id, d);
    }
    return m;
  }, [dogadjaji]);

  const lista = useMemo(() => {
    const u = zaPretragu(upit);
    return pokojnici.filter((p) => {
      if (filter === "bez_datuma" && p.datum_smrti) return false;
      if (filter === "novo" && !p.novo) return false;
      if (filter === "za_proveru" && !p.za_proveru) return false;
      return !u || zaPretragu(p.ime_prezime).includes(u);
    });
  }, [pokojnici, filter, upit]);

  const filteri: [Filter, string, number][] = [
    ["svi", "Сви", pokojnici.length],
    ["bez_datuma", "Без датума смрти", pokojnici.filter((p) => !p.datum_smrti).length],
    ["novo", "Ново од породице", pokojnici.filter((p) => p.novo).length],
    ["za_proveru", "За проверу", pokojnici.filter((p) => p.za_proveru).length],
  ];

  return (
    <>
      <div className="pretraga">
        <input
          type="search"
          placeholder="Претрага по имену"
          aria-label="Претрага по имену"
          value={upit}
          onChange={(e) => setUpit(e.target.value)}
        />
      </div>
      <div className="filteri" role="group" aria-label="Филтер">
        {filteri.map(
          ([f, naziv, n]) =>
            (f === "svi" || n > 0) && (
              <button key={f} className={filter === f ? "aktivan" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {naziv} {n}
              </button>
            ),
        )}
      </div>

      {lista.length === 0 ? (
        <p className="tiho pad">Нема записа за ову претрагу.</p>
      ) : (
        <ul className="lista">
          {lista.map((p) => {
            const s = sledeci.get(p.id);
            return (
              <li key={p.id} className="red">
                <button className="red-glavno" onClick={() => otvori(p.id)}>
                  <span className="red-tekst">
                    <span className="ime">
                      {p.ime_prezime}
                      {p.novo && <span className="oznaka oznaka-plava">ново</span>}
                      {p.za_proveru && <span className="oznaka oznaka-siva">провери</span>}
                    </span>
                    {p.datum_smrti ? (
                      <span className="mesto">
                        † {formatDatum(p.datum_smrti)}
                        {p.mesto_sahrane ? `, ${p.mesto_sahrane}` : ""}
                      </span>
                    ) : (
                      <span className="mesto bez-datuma">Нема датума смрти</span>
                    )}
                  </span>
                  {s && (
                    <span className="sledeci">
                      <span className={`vrsta v-${s.vrsta}`}>{NAZIV_VRSTE[s.vrsta]}</span>
                      <span>{zaTekst(s.zaDana)}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
