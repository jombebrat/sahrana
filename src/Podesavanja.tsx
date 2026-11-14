import { useState, type FormEvent } from "react";
import { fn, obrisiKes, sacuvajPodesavanja, sb, type Podaci } from "./sb";
import { ukljuciObavestenja, type StanjeOb } from "./obavestenja";

function izvezi(podaci: Podaci) {
  const polje = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const redovi = [
    ["Име и презиме", "Датум смрти", "Датум сахране", "Година рођења", "Место сахране", "Кремација", "Контакт", "Телефон", "WhatsApp", "Напомена"],
    ...[...podaci.pokojnici]
      .sort((a, b) => (a.datum_smrti ?? "9999").localeCompare(b.datum_smrti ?? "9999"))
      .map((p) => [
        p.ime_prezime, p.datum_smrti, p.datum_sahrane, p.godina_rodjenja, p.mesto_sahrane,
        p.kremacija ? "да" : "", p.kontakt_ime, p.kontakt_telefon, p.whatsapp ? "да" : "", p.napomena,
      ]),
  ];
  const csv = "﻿" + redovi.map((r) => r.map(polje).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `parastosi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export default function Podesavanja(props: {
  podaci: Podaci;
  stanjeOb: StanjeOb | null;
  setStanjeOb: (s: StanjeOb) => void;
  zatvori: () => void;
  osvezi: () => Promise<void>;
}) {
  const { podaci, stanjeOb, setStanjeOb, zatvori, osvezi } = props;
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);
  const [lozinka, setLozinka] = useState("");

  async function ukljuci() {
    setRadi(true);
    setPoruka(null);
    try {
      const s = await ukljuciObavestenja();
      setStanjeOb(s);
      if (s === "ukljuceno") setPoruka("Обавештења су укључена на овом телефону.");
    } catch {
      setPoruka("Укључивање није успело. Провери интернет везу и покушај поново.");
    } finally {
      setRadi(false);
    }
  }

  async function proba() {
    setRadi(true);
    setPoruka(null);
    try {
      const o = await fn<{ poslato?: number; greske?: string[] }>("proba", { telo: {}, saPrijavom: true });
      setPoruka(
        o.poslato
          ? "Пробно обавештење је послато. Требало би да стигне за неколико секунди."
          : `Слање није успело.${o.greske?.length ? " " + o.greske[0] : ""}`,
      );
    } catch {
      setPoruka("Слање није успело. Провери интернет везу.");
    } finally {
      setRadi(false);
    }
  }

  async function promeni(p: Partial<Podaci["pod"]>) {
    setPoruka(null);
    try {
      await sacuvajPodesavanja(p);
      await osvezi();
    } catch {
      setPoruka("Промена није сачувана. Провери интернет везу.");
    }
  }

  async function promeniLozinku(e: FormEvent) {
    e.preventDefault();
    if (lozinka.length < 8) return setPoruka("Лозинка мора имати најмање 8 знакова.");
    const { error } = await sb.auth.updateUser({ password: lozinka });
    setPoruka(error ? "Лозинка није промењена. Покушај поново." : "Лозинка је промењена.");
    if (!error) setLozinka("");
  }

  async function odjava() {
    await sb.auth.signOut();
    obrisiKes();
  }

  const { pod } = podaci;
  return (
    <div className="sloj" role="dialog" aria-modal="true" aria-label="Подешавања">
      <header className="sloj-zaglavlje">
        <button className="krug staklo" aria-label="Затвори" onClick={zatvori}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <strong>Подешавања</strong>
      </header>

      <div className="sloj-telo forma">
        <h3>Обавештења</h3>
        {stanjeOb === "ukljuceno" && (
          <>
            <p>Укључена су на овом телефону.</p>
            <button className="dugme sporedno" disabled={radi} onClick={proba}>Пошаљи пробно обавештење</button>
          </>
        )}
        {stanjeOb === "iskljuceno" && (
          <>
            <p>Подсетник стиже {pod.dana_unapred} дана пре сваког помена, и кад породица пошаље податке.</p>
            <button className="dugme" disabled={radi} onClick={ukljuci}>Укључи обавештења</button>
          </>
        )}
        {stanjeOb === "instaliraj" && (
          <div className="obavest-crvena">
            <p>На iPhone-у обавештења раде тек кад се апликација дода на почетни екран:</p>
            <ol>
              <li>Отвори ову страницу у Safari-ју.</li>
              <li>Додирни дугме за дељење (квадрат са стрелицом нагоре).</li>
              <li>Изабери „Додај на почетни екран”.</li>
              <li>Отвори „Парастоси” са почетног екрана и врати се у Подешавања.</li>
            </ol>
          </div>
        )}
        {stanjeOb === "blokirano" && (
          <p className="obavest-crvena">
            Обавештења су забрањена за ову апликацију. Дозволи их у подешавањима телефона: Обавештења, па Парастоси.
          </p>
        )}
        {stanjeOb === "nepodrzano" && <p className="tiho">Овај прегледач не подржава обавештења.</p>}
        {poruka && <p className="traka traka-siva" role="status">{poruka}</p>}

        <label>
          Колико дана пре помена стиже подсетник
          <select value={pod.dana_unapred} onChange={(e) => promeni({ dana_unapred: Number(e.target.value) })}>
            {[7, 10, 14, 21, 30].map((n) => (
              <option key={n} value={n}>{n} дана</option>
            ))}
          </select>
        </label>
        <label>
          У колико сати стиже
          <select value={pod.cas_slanja} onChange={(e) => promeni({ cas_slanja: Number(e.target.value) })}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </label>

        <h3>Рачунање 40 дана</h3>
        <fieldset className="izbor">
          <legend>Како се броји</legend>
          <label className={pod.dana_40 === 40 ? "aktivan" : ""}>
            <input type="radio" name="d40" checked={pod.dana_40 === 40} onChange={() => promeni({ dana_40: 40 })} />
            Датум смрти + 40 дана (као у Excel‑у)
          </label>
          <label className={pod.dana_40 === 39 ? "aktivan" : ""}>
            <input type="radio" name="d40" checked={pod.dana_40 === 39} onChange={() => promeni({ dana_40: 39 })} />
            Дан смрти је први дан
          </label>
        </fieldset>

        <h3>Подаци</h3>
        <button className="dugme sporedno" onClick={() => izvezi(podaci)}>Извези у Excel (CSV)</button>

        <h3>Лозинка</h3>
        <form onSubmit={promeniLozinku} className="forma">
          <label>
            Нова лозинка
            <input type="password" autoComplete="new-password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} minLength={8} />
          </label>
          <button className="dugme sporedno" disabled={!lozinka}>Промени лозинку</button>
        </form>

        <div className="opasno">
          <button className="tekst-dugme crveni-tekst" onClick={odjava}>Одјави се</button>
        </div>
      </div>
    </div>
  );
}
