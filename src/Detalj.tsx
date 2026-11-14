import { useEffect, useState } from "react";
import { danUNedelji, formatDatum, NAZIV_VRSTE, zaTekst } from "../supabase/functions/parastosi/pomeni.ts";
import { obrisiPokojnika, oznaciVidjeno, postaviObavljeno, type Pokojnik } from "./sb";
import { zaPoziv, zaWhatsApp } from "./util";
import { IkonaTelefon, Listic, type Dogadjaj } from "./Glavni";

export default function Detalj(props: {
  pokojnik: Pokojnik | null;
  pomeni: Dogadjaj[];
  zatvori: () => void;
  izmeni: () => void;
  osvezi: () => Promise<void>;
}) {
  const { pokojnik: p, pomeni, zatvori, izmeni, osvezi } = props;
  const [brisanje, setBrisanje] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  // Отворен запис више није „нов“.
  useEffect(() => {
    if (p?.novo) oznaciVidjeno(p.id).then(osvezi).catch(() => {});
  }, [p?.id, p?.novo, osvezi]);

  if (!p) {
    return (
      <div className="sloj" role="dialog" aria-modal="true">
        <header className="sloj-zaglavlje">
          <button className="krug staklo" aria-label="Затвори" onClick={zatvori}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          </button>
        </header>
        <p className="tiho pad">Запис није пронађен. Можда је обрисан.</p>
      </div>
    );
  }

  async function stikliraj(d: Dogadjaj) {
    setGreska(null);
    try {
      await postaviObavljeno(d.p.id, d.vrsta, !d.obavljeno);
      await osvezi();
    } catch {
      setGreska("Промена није сачувана. Провери интернет везу.");
    }
  }

  async function obrisi() {
    try {
      await obrisiPokojnika(p!.id);
      await osvezi();
      zatvori();
    } catch {
      setGreska("Брисање није успело. Провери интернет везу.");
    }
  }

  const tel = p.kontakt_telefon;
  return (
    <div className="sloj" role="dialog" aria-modal="true" aria-label={p.ime_prezime}>
      <header className="sloj-zaglavlje">
        <button className="krug staklo" aria-label="Затвори" onClick={zatvori}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button className="kapsula staklo" onClick={izmeni}>Измени</button>
      </header>

      <div className="sloj-telo">
        <h2 className="veliko-ime">{p.ime_prezime}</h2>
        <p className="oznake">
          {p.izvor === "link" && <span className="oznaka oznaka-plava">унела породица</span>}
          {p.za_proveru && <span className="oznaka oznaka-siva">провери податке</span>}
        </p>

        {greska && <p className="greska" role="alert">{greska}</p>}

        <h3>Помени</h3>
        {pomeni.length === 0 ? (
          <div className="obavest-crvena">
            <p>Нема датума смрти, па се помени не рачунају.</p>
            <button className="dugme" onClick={izmeni}>Допуни датум смрти</button>
          </div>
        ) : (
          <ul className="pomeni">
            {pomeni.map((d) => (
              <li key={d.vrsta} className={d.obavljeno ? "obavljen" : ""}>
                <Listic datum={d.datum} vrsta={d.vrsta} />
                <span className="red-tekst">
                  <span className={`vrsta v-${d.vrsta}`}>{NAZIV_VRSTE[d.vrsta]}</span>
                  <span className="mesto">
                    {danUNedelji(d.datum)} {formatDatum(d.datum)}
                  </span>
                  <span className="mesto">{d.obavljeno ? "обављено" : zaTekst(d.zaDana)}</span>
                </span>
                <label className="stikla">
                  <input type="checkbox" checked={d.obavljeno} onChange={() => stikliraj(d)} />
                  Обављено
                </label>
              </li>
            ))}
          </ul>
        )}

        <h3>Подаци</h3>
        <dl className="podaci">
          <dt>Датум смрти</dt>
          <dd>{p.datum_smrti ? formatDatum(p.datum_smrti) : "није уписан"}</dd>
          <dt>Сахрана</dt>
          <dd>
            {[p.datum_sahrane ? formatDatum(p.datum_sahrane) : null, p.mesto_sahrane, p.kremacija ? "кремација" : null]
              .filter(Boolean)
              .join(", ") || "није уписано"}
          </dd>
          {p.godina_rodjenja && (
            <>
              <dt>Година рођења</dt>
              <dd>{p.godina_rodjenja}</dd>
            </>
          )}
          {p.napomena && (
            <>
              <dt>Напомена</dt>
              <dd>{p.napomena}</dd>
            </>
          )}
        </dl>

        <h3>Контакт</h3>
        {p.kontakt_ime || tel ? (
          <div className="kontakt">
            <p>
              {p.kontakt_ime && <strong>{p.kontakt_ime}</strong>}
              {tel && <span>{tel}</span>}
            </p>
            {tel && (
              <div className="kontakt-dugmad">
                <a className="dugme" href={`tel:${zaPoziv(tel)}`}>
                  <IkonaTelefon /> Позови
                </a>
                <a className="dugme sporedno" href={`https://wa.me/${zaWhatsApp(tel)}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="tiho">Контакт није уписан.</p>
        )}

        <div className="opasno">
          {brisanje ? (
            <>
              <p>Обрисати запис „{p.ime_prezime}”? Ово се не може вратити.</p>
              <button className="dugme crveno" onClick={obrisi}>Обриши запис</button>
              <button className="dugme sporedno" onClick={() => setBrisanje(false)}>Одустани</button>
            </>
          ) : (
            <button className="tekst-dugme crveni-tekst" onClick={() => setBrisanje(true)}>Обриши запис</button>
          )}
        </div>
      </div>
    </div>
  );
}
