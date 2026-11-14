import { useState, type FormEvent } from "react";
import { danasUParizu, danUNedelji, formatDatum, jeDatum, NAZIV_VRSTE, pomeniZa } from "../supabase/functions/parastosi/pomeni.ts";
import { sacuvajPokojnika, type Pokojnik, type PokojnikUnos } from "./sb";
import { Listic } from "./Glavni";

export default function Formular(props: {
  pokojnik: Pokojnik | null;
  dana40: number;
  zatvori: () => void;
  sacuvano: (id: string) => void | Promise<void>;
}) {
  const { pokojnik: p, dana40, zatvori, sacuvano } = props;
  const [ime, setIme] = useState(p?.ime_prezime ?? "");
  const [smrt, setSmrt] = useState(p?.datum_smrti ?? "");
  const [sahrana, setSahrana] = useState(p?.datum_sahrane ?? "");
  const [godina, setGodina] = useState(p?.godina_rodjenja ? String(p.godina_rodjenja) : "");
  const [mesto, setMesto] = useState(p?.mesto_sahrane ?? "");
  const [kremacija, setKremacija] = useState(p?.kremacija ?? false);
  const [kontaktIme, setKontaktIme] = useState(p?.kontakt_ime ?? "");
  const [telefon, setTelefon] = useState(p?.kontakt_telefon ?? "");
  const [whatsapp, setWhatsapp] = useState(p?.whatsapp ?? false);
  const [napomena, setNapomena] = useState(p?.napomena ?? "");
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const danas = danasUParizu();
  const pomeni = jeDatum(smrt) ? pomeniZa(smrt, danas, dana40) : [];

  async function sacuvaj(e: FormEvent) {
    e.preventDefault();
    if (!ime.trim()) return setGreska("Упиши име и презиме.");
    if (smrt && smrt > danas) return setGreska("Датум смрти не може бити у будућности.");
    const g = godina.trim() ? Number(godina) : null;
    if (g !== null && (!Number.isInteger(g) || g < 1850 || g > Number(danas.slice(0, 4)))) {
      return setGreska("Година рођења није исправна.");
    }
    const unos: PokojnikUnos = {
      ime_prezime: ime.trim(),
      datum_smrti: smrt || null,
      datum_sahrane: sahrana || null,
      godina_rodjenja: g,
      mesto_sahrane: mesto.trim() || null,
      kremacija,
      kontakt_ime: kontaktIme.trim() || null,
      kontakt_telefon: telefon.trim() || null,
      whatsapp,
      napomena: napomena.trim() || null,
      za_proveru: false,
    };
    setRadi(true);
    setGreska(null);
    try {
      await sacuvano(await sacuvajPokojnika(p?.id ?? null, unos));
    } catch {
      setGreska("Чување није успело. Провери интернет везу и покушај поново.");
      setRadi(false);
    }
  }

  return (
    <div className="sloj" role="dialog" aria-modal="true" aria-label={p ? "Измена записа" : "Нови унос"}>
      <header className="sloj-zaglavlje">
        <button className="tekst-dugme" onClick={zatvori}>Одустани</button>
        <strong>{p ? "Измена записа" : "Нови унос"}</strong>
      </header>

      <form className="sloj-telo forma" onSubmit={sacuvaj}>
        <label>
          Име и презиме упокојеног
          <input value={ime} onChange={(e) => setIme(e.target.value)} autoComplete="off" required />
        </label>
        <label>
          Датум смрти
          <input type="date" value={smrt} max={danas} onChange={(e) => setSmrt(e.target.value)} />
        </label>

        {pomeni.length > 0 ? (
          <ul className="pregled-pomena" aria-label="Израчунати помени">
            {pomeni.map((d) => (
              <li key={d.vrsta}>
                <Listic datum={d.datum} vrsta={d.vrsta} />
                <span className="red-tekst">
                  <span className={`vrsta v-${d.vrsta}`}>{NAZIV_VRSTE[d.vrsta]}</span>
                  <span className="mesto">
                    {danUNedelji(d.datum)} {formatDatum(d.datum)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiho">Помени се рачунају чим упишеш датум смрти.</p>
        )}

        <label>
          Датум сахране
          <input type="date" value={sahrana} onChange={(e) => setSahrana(e.target.value)} />
        </label>
        <label>
          Година рођења
          <input inputMode="numeric" pattern="[0-9]*" maxLength={4} value={godina} onChange={(e) => setGodina(e.target.value)} />
        </label>
        <label>
          Место сахране или гробље
          <input value={mesto} onChange={(e) => setMesto(e.target.value)} />
        </label>
        <label className="stikla">
          <input type="checkbox" checked={kremacija} onChange={(e) => setKremacija(e.target.checked)} />
          Кремација
        </label>
        <label>
          Контакт особа
          <input value={kontaktIme} onChange={(e) => setKontaktIme(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Телефон
          <input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} autoComplete="off" />
        </label>
        <label className="stikla">
          <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
          Број је на WhatsApp-у
        </label>
        <label>
          Напомена
          <textarea rows={3} value={napomena} onChange={(e) => setNapomena(e.target.value)} />
        </label>

        {greska && <p className="greska" role="alert">{greska}</p>}
        <button className="dugme" disabled={radi}>{radi ? "Чување…" : "Сачувај"}</button>
      </form>
    </div>
  );
}
