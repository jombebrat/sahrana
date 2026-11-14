import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { DEMO, EMAIL_VLASNIKA } from "./config";
import { fn, sb } from "./sb";
import Glavni from "./Glavni";

export default function App() {
  const [sesija, setSesija] = useState<Session | null | undefined>(DEMO ? ({} as Session) : undefined);

  useEffect(() => {
    if (DEMO) return;
    sb.auth.getSession().then(({ data }) => setSesija(data.session));
    const { data } = sb.auth.onAuthStateChange((_d, s) => setSesija(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (sesija === undefined) return <div className="prazno" aria-busy="true" />;
  return sesija ? <Glavni /> : <Ulaz />;
}

type Korak = "provera" | "podesi" | "lozinka" | "bez_mreze";

function Ulaz() {
  const [korak, setKorak] = useState<Korak>("provera");
  const [kod, setKod] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [potvrda, setPotvrda] = useState("");
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const proveri = () => {
    setKorak("provera");
    fn<{ podeseno: boolean }>("stanje")
      .then((s) => setKorak(s.podeseno ? "lozinka" : "podesi"))
      .catch(() => setKorak("bez_mreze"));
  };
  useEffect(proveri, []);

  async function prijavi(e: FormEvent) {
    e.preventDefault();
    setRadi(true);
    setPoruka(null);
    const { error } = await sb.auth.signInWithPassword({ email: EMAIL_VLASNIKA, password: lozinka });
    setRadi(false);
    if (error) {
      setPoruka(
        error.status === 400
          ? "Лозинка није тачна."
          : "Пријава није успела. Провери интернет везу и покушај поново.",
      );
    }
  }

  async function podesi(e: FormEvent) {
    e.preventDefault();
    if (lozinka.length < 8) return setPoruka("Лозинка мора имати најмање 8 знакова.");
    if (lozinka !== potvrda) return setPoruka("Лозинке се не поклапају.");
    setRadi(true);
    setPoruka(null);
    try {
      const o = await fn<{ ok: boolean; razlog?: string }>("podesi", { telo: { kod, lozinka } });
      if (!o.ok) {
        setPoruka(
          o.razlog === "kod"
            ? "Код није тачан."
            : o.razlog === "vec"
              ? "Апликација је већ подешена. Пријави се лозинком."
              : "Подешавање није успело. Покушај поново.",
        );
        if (o.razlog === "vec") proveri();
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email: EMAIL_VLASNIKA, password: lozinka });
      if (error) proveri();
    } catch {
      setPoruka("Нема везе са сервером. Покушај поново.");
    } finally {
      setRadi(false);
    }
  }

  return (
    <div className="ulaz">
      <h1>Парастоси</h1>
      {korak === "provera" && <p className="tiho">Учитавање…</p>}

      {korak === "bez_mreze" && (
        <>
          <p>Нема везе са сервером. За прву пријаву је потребан интернет.</p>
          <button className="dugme" onClick={proveri}>Покушај поново</button>
        </>
      )}

      {korak === "lozinka" && (
        <form onSubmit={prijavi}>
          <label>
            Лозинка
            <input
              type="password"
              autoComplete="current-password"
              value={lozinka}
              onChange={(e) => setLozinka(e.target.value)}
              autoFocus
              required
            />
          </label>
          {poruka && <p className="greska" role="alert">{poruka}</p>}
          <button className="dugme" disabled={radi}>{radi ? "Пријављивање…" : "Пријави се"}</button>
        </form>
      )}

      {korak === "podesi" && (
        <form onSubmit={podesi}>
          <p>Прво покретање: упиши код који си добио и изабери своју лозинку.</p>
          <label>
            Код за подешавање
            <input
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              required
            />
          </label>
          <label>
            Нова лозинка (најмање 8 знакова)
            <input
              type="password"
              autoComplete="new-password"
              value={lozinka}
              onChange={(e) => setLozinka(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Понови лозинку
            <input
              type="password"
              autoComplete="new-password"
              value={potvrda}
              onChange={(e) => setPotvrda(e.target.value)}
              required
            />
          </label>
          {poruka && <p className="greska" role="alert">{poruka}</p>}
          <button className="dugme" disabled={radi}>{radi ? "Чување…" : "Сачувај лозинку и уђи"}</button>
        </form>
      )}
    </div>
  );
}
