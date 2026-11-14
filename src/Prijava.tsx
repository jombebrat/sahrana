import { useEffect, useState, type FormEvent } from "react";
import { danasUParizu } from "../supabase/functions/parastosi/pomeni.ts";
import { fn } from "./sb";

type Jezik = "sr" | "fr";

const T = {
  sr: {
    naslov: "Подаци о упокојеном",
    uvod: "Молимо вас да попуните овај формулар. Подаци служе само за припрему парастоса: 40 дана, пола године и година.",
    ime: "Име и презиме упокојеног",
    smrt: "Датум смрти",
    sahrana: "Датум сахране",
    godina: "Година рођења",
    mesto: "Место сахране или гробље",
    kremacija: "Кремација",
    kontakt: "Ваше име и презиме",
    telefon: "Ваш телефон",
    whatsapp: "Овај број је на WhatsApp-у",
    napomena: "Напомена",
    obavezno: "обавезно",
    posalji: "Пошаљи податке",
    slanje: "Слање…",
    hvala: "Хвала. Подаци су послати.",
    hvala2: "Можете затворити ову страницу.",
    nevazi: "Овај линк више не важи. Затражите нови.",
    polja: "Проверите обележена поља.",
    mreza: "Слање није успело. Проверите интернет везу и покушајте поново.",
    privatnost: "Податке добија само особа која вам је послала овај линк. Не деле се ни са ким.",
    provera: "Учитавање…",
  },
  fr: {
    naslov: "Informations sur le défunt",
    uvod: "Merci de remplir ce formulaire. Ces informations servent uniquement à préparer les offices de commémoration : 40 jours, six mois et un an.",
    ime: "Nom et prénom du défunt",
    smrt: "Date du décès",
    sahrana: "Date des obsèques",
    godina: "Année de naissance",
    mesto: "Lieu d'inhumation ou cimetière",
    kremacija: "Crémation",
    kontakt: "Vos nom et prénom",
    telefon: "Votre téléphone",
    whatsapp: "Ce numéro est sur WhatsApp",
    napomena: "Remarque",
    obavezno: "obligatoire",
    posalji: "Envoyer les informations",
    slanje: "Envoi…",
    hvala: "Merci. Les informations ont bien été envoyées.",
    hvala2: "Vous pouvez fermer cette page.",
    nevazi: "Ce lien n'est plus valide. Demandez un nouveau lien.",
    polja: "Vérifiez les champs signalés.",
    mreza: "L'envoi a échoué. Vérifiez votre connexion et réessayez.",
    privatnost: "Ces informations sont transmises uniquement à la personne qui vous a envoyé ce lien. Elles ne sont partagées avec personne.",
    provera: "Chargement…",
  },
} satisfies Record<Jezik, Record<string, string>>;

type Stanje = "provera" | "forma" | "nevazi" | "poslato";

export default function Prijava({ token }: { token: string }) {
  const [jezik, setJezik] = useState<Jezik>(navigator.language.toLowerCase().startsWith("fr") ? "fr" : "sr");
  const [stanje, setStanje] = useState<Stanje>("provera");
  const [lose, setLose] = useState<string[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);
  const [f, setF] = useState({
    ime_prezime: "", datum_smrti: "", datum_sahrane: "", godina_rodjenja: "", mesto_sahrane: "",
    kremacija: false, kontakt_ime: "", kontakt_telefon: "", whatsapp: false, napomena: "",
  });
  const t = T[jezik];
  const danas = danasUParizu();

  useEffect(() => {
    document.documentElement.lang = jezik === "fr" ? "fr" : "sr-Cyrl";
    document.title = t.naslov;
  }, [jezik, t.naslov]);

  useEffect(() => {
    fn<{ ok: boolean; jezik?: Jezik }>("link", { upit: `t=${encodeURIComponent(token)}` })
      .then((o) => {
        if (!o.ok) return setStanje("nevazi");
        if (o.jezik) setJezik(o.jezik);
        setStanje("forma");
      })
      .catch(() => setStanje("forma"));
  }, [token]);

  const polje = (k: keyof typeof f) => ({
    value: f[k] as string,
    onChange: (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value })),
    "aria-invalid": lose.includes(k) || undefined,
  });

  async function posalji(e: FormEvent) {
    e.preventDefault();
    setRadi(true);
    setGreska(null);
    setLose([]);
    try {
      const o = await fn<{ ok: boolean; razlog?: string; polja?: string[] }>("prijava", {
        telo: { t: token, podaci: f },
      });
      if (o.ok) setStanje("poslato");
      else if (o.razlog === "link") setStanje("nevazi");
      else {
        setLose(o.polja ?? []);
        setGreska(t.polja);
      }
    } catch {
      setGreska(t.mreza);
    } finally {
      setRadi(false);
    }
  }

  return (
    <div className="prijava">
      <div className="jezici" role="group" aria-label="Језик / Langue">
        <button className={jezik === "sr" ? "aktivan" : ""} aria-pressed={jezik === "sr"} onClick={() => setJezik("sr")}>Српски</button>
        <button className={jezik === "fr" ? "aktivan" : ""} aria-pressed={jezik === "fr"} onClick={() => setJezik("fr")}>Français</button>
      </div>

      <h1>{t.naslov}</h1>

      {stanje === "provera" && <p className="tiho">{t.provera}</p>}
      {stanje === "nevazi" && <p className="obavest-crvena">{t.nevazi}</p>}
      {stanje === "poslato" && (
        <div className="hvala">
          <p>{t.hvala}</p>
          <p className="tiho">{t.hvala2}</p>
        </div>
      )}

      {stanje === "forma" && (
        <form className="forma" onSubmit={posalji}>
          <p>{t.uvod}</p>
          <label>
            <span>{t.ime} <em>{t.obavezno}</em></span>
            <input {...polje("ime_prezime")} required autoComplete="off" />
          </label>
          <label>
            <span>{t.smrt} <em>{t.obavezno}</em></span>
            <input type="date" max={danas} {...polje("datum_smrti")} required />
          </label>
          <label>
            {t.sahrana}
            <input type="date" {...polje("datum_sahrane")} />
          </label>
          <label>
            {t.godina}
            <input inputMode="numeric" pattern="[0-9]*" maxLength={4} {...polje("godina_rodjenja")} />
          </label>
          <label>
            {t.mesto}
            <input {...polje("mesto_sahrane")} />
          </label>
          <label className="stikla">
            <input type="checkbox" checked={f.kremacija} onChange={(e) => setF((s) => ({ ...s, kremacija: e.target.checked }))} />
            {t.kremacija}
          </label>
          <label>
            <span>{t.kontakt} <em>{t.obavezno}</em></span>
            <input {...polje("kontakt_ime")} required autoComplete="name" />
          </label>
          <label>
            <span>{t.telefon} <em>{t.obavezno}</em></span>
            <input type="tel" {...polje("kontakt_telefon")} required autoComplete="tel" />
          </label>
          <label className="stikla">
            <input type="checkbox" checked={f.whatsapp} onChange={(e) => setF((s) => ({ ...s, whatsapp: e.target.checked }))} />
            {t.whatsapp}
          </label>
          <label>
            {t.napomena}
            <textarea rows={3} {...polje("napomena")} />
          </label>

          {greska && <p className="greska" role="alert">{greska}</p>}
          <button className="dugme" disabled={radi}>{radi ? t.slanje : t.posalji}</button>
          <p className="tiho">{t.privatnost}</p>
        </form>
      )}
    </div>
  );
}
