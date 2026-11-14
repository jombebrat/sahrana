import { useEffect, useState, type FormEvent } from "react";
import { formatDatum } from "../supabase/functions/parastosi/pomeni.ts";
import { napraviLink, opozoviLink, ucitajLinkove, type Link } from "./sb";
import { noviToken } from "./util";

const urlZa = (l: { token: string }) => `${location.origin}${location.pathname}?p=${l.token}`;

function stanjeLinka(l: Link): { vazi: boolean; tekst: string } {
  if (l.opozvan) return { vazi: false, tekst: "опозван" };
  if (new Date(l.istice) < new Date()) return { vazi: false, tekst: "истекао" };
  if (l.jednokratan && l.broj_prijava >= 1) return { vazi: false, tekst: "искоришћен" };
  return { vazi: true, tekst: `важи до ${formatDatum(l.istice.slice(0, 10))}` };
}

export default function Linkovi() {
  const [linkovi, setLinkovi] = useState<Link[] | null>(null);
  const [naziv, setNaziv] = useState("");
  const [jezik, setJezik] = useState<"sr" | "fr">("sr");
  const [jednokratan, setJednokratan] = useState(true);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const osvezi = () =>
    ucitajLinkove()
      .then(setLinkovi)
      .catch(() => setPoruka("Линкови нису учитани. Провери интернет везу."));
  useEffect(() => {
    osvezi();
  }, []);

  async function podeli(l: { token: string; jezik: "sr" | "fr" }) {
    const url = urlZa(l);
    const text =
      l.jezik === "fr"
        ? "Merci de remplir les informations concernant le défunt :"
        : "Молимо вас да попуните податке о упокојеном:";
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setPoruka("Линк је копиран.");
      }
    } catch {
      /* корисник је затворио дељење */
    }
  }

  async function kopiraj(l: Link) {
    try {
      await navigator.clipboard.writeText(urlZa(l));
      setPoruka("Линк је копиран.");
    } catch {
      setPoruka(urlZa(l));
    }
  }

  async function napravi(e: FormEvent) {
    e.preventDefault();
    setRadi(true);
    setPoruka(null);
    const novi = { token: noviToken(), naziv: naziv.trim() || null, jezik, jednokratan };
    try {
      await napraviLink(novi);
      setNaziv("");
      await osvezi();
      await podeli(novi);
    } catch {
      setPoruka("Линк није направљен. Провери интернет везу.");
    } finally {
      setRadi(false);
    }
  }

  async function opozovi(l: Link) {
    try {
      await opozoviLink(l.id);
      await osvezi();
    } catch {
      setPoruka("Опозив није успео. Провери интернет везу.");
    }
  }

  return (
    <>
      <section>
        <h2>Нови линк за породицу</h2>
        <p className="tiho pad-x uvod">
          Породица отвара линк, попуњава податке о упокојеном, и запис стиже у апликацију сам.
        </p>
        <form className="forma pad-x" onSubmit={napravi}>
          <label>
            За кога је линк (види се само теби)
            <input value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="нпр. породица Петровић" />
          </label>
          <fieldset className="izbor">
            <legend>Језик формулара (породица може да га промени)</legend>
            <label className={jezik === "sr" ? "aktivan" : ""}>
              <input type="radio" name="jezik" checked={jezik === "sr"} onChange={() => setJezik("sr")} /> Српски
            </label>
            <label className={jezik === "fr" ? "aktivan" : ""}>
              <input type="radio" name="jezik" checked={jezik === "fr"} onChange={() => setJezik("fr")} /> Француски
            </label>
          </fieldset>
          <label className="stikla">
            <input type="checkbox" checked={jednokratan} onChange={(e) => setJednokratan(e.target.checked)} />
            Важи само за једну пријаву
          </label>
          <button className="dugme" disabled={radi}>{radi ? "Прављење…" : "Направи и подели линк"}</button>
        </form>
        {poruka && <p className="traka traka-siva" role="status">{poruka}</p>}
      </section>

      <section>
        <h2>Послати линкови</h2>
        {linkovi === null ? (
          <p className="tiho pad">Учитавање…</p>
        ) : linkovi.length === 0 ? (
          <p className="tiho pad">Још нема линкова. Први направи изнад.</p>
        ) : (
          <ul className="lista">
            {linkovi.map((l) => {
              const s = stanjeLinka(l);
              return (
                <li key={l.id} className={`link-red${s.vazi ? "" : " obavljen"}`}>
                  <div className="red-tekst">
                    <span className="ime">{l.naziv ?? "Линк без назива"}</span>
                    <span className="mesto">
                      {l.jezik === "fr" ? "француски" : "српски"}, {s.tekst}, пријава: {l.broj_prijava}
                    </span>
                  </div>
                  {s.vazi && (
                    <div className="link-dugmad">
                      <button className="dugme malo" onClick={() => podeli(l)}>Подели</button>
                      <button className="dugme malo sporedno" onClick={() => kopiraj(l)}>Копирај</button>
                      <button className="tekst-dugme crveni-tekst" onClick={() => opozovi(l)}>Опозови</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
