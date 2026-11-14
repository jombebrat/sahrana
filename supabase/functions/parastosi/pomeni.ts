// Сва логика датума на једном месту. Исти фајл користе апликација и сервер.
// Датуми су текст 'YYYY-MM-DD'; рачуна се у целим данима, без часовних зона.

export type Vrsta = "40" | "pola" | "godina";
export const VRSTE: Vrsta[] = ["40", "pola", "godina"];

export const NAZIV_VRSTE: Record<Vrsta, string> = {
  "40": "40 дана",
  pola: "Пола године",
  godina: "Година",
};

const DAN_MS = 86400000;

/** Број дана од 1.1.1970. за датум 'YYYY-MM-DD'. */
export function uDan(iso: string): number {
  const [g, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(g, m - 1, d) / DAN_MS);
}

export function izDana(n: number): string {
  return new Date(n * DAN_MS).toISOString().slice(0, 10);
}

export function jeDatum(iso: unknown): iso is string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return izDana(uDan(iso)) === iso;
}

function danaUMesecu(godina: number, mesec: number): number {
  return new Date(Date.UTC(godina, mesec, 0)).getUTCDate();
}

/** Исти дан, `meseci` касније; ако тај дан не постоји, последњи дан месеца. */
export function dodajMesece(iso: string, meseci: number): string {
  const [g, m, d] = iso.split("-").map(Number);
  const ukupno = m - 1 + meseci;
  const godina = g + Math.floor(ukupno / 12);
  const mesec = (ukupno % 12) + 1;
  const dan = Math.min(d, danaUMesecu(godina, mesec));
  return `${godina}-${String(mesec).padStart(2, "0")}-${String(dan).padStart(2, "0")}`;
}

/**
 * Правила из Excel-а:
 *  40 дана     = датум смрти + 40 дана (подешавање 39: дан смрти је први дан)
 *  пола године = исти дан, 6 месеци касније
 *  година      = исти дан и месец следеће године
 */
export function datumPomena(datumSmrti: string, vrsta: Vrsta, dana40 = 40): string {
  if (vrsta === "40") return izDana(uDan(datumSmrti) + dana40);
  return dodajMesece(datumSmrti, vrsta === "pola" ? 6 : 12);
}

/** Данашњи датум у Паризу. */
export function danasUParizu(sada: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sada);
}

export function casUParizu(sada: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(sada);
  return Number(h);
}

export type Status = "obavljeno" | "ova_nedelja" | "uskoro" | "kasnije" | "skoro_proslo" | "proslo";

/** Статус помена према броју дана до њега (негативно = прошло). */
export function statusPomena(zaDana: number, obavljeno = false): Status {
  if (obavljeno) return "obavljeno";
  if (zaDana < -7) return "proslo";
  if (zaDana < 0) return "skoro_proslo";
  if (zaDana <= 7) return "ova_nedelja";
  if (zaDana <= 60) return "uskoro";
  return "kasnije";
}

export interface Pomen {
  vrsta: Vrsta;
  datum: string;
  zaDana: number;
  status: Status;
  obavljeno: boolean;
}

/** Сва три помена за један датум смрти. */
export function pomeniZa(
  datumSmrti: string,
  danas: string,
  dana40 = 40,
  obavljeno: Partial<Record<Vrsta, boolean>> = {},
): Pomen[] {
  const d0 = uDan(danas);
  return VRSTE.map((vrsta) => {
    const datum = datumPomena(datumSmrti, vrsta, dana40);
    const zaDana = uDan(datum) - d0;
    const ob = !!obavljeno[vrsta];
    return { vrsta, datum, zaDana, status: statusPomena(zaDana, ob), obavljeno: ob };
  });
}

const DANI = ["недеља", "понедељак", "уторак", "среда", "четвртак", "петак", "субота"];
export const MESECI_KRATKO = ["јан", "феб", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "нов", "дец"];

export function danUNedelji(iso: string): string {
  return DANI[new Date(uDan(iso) * DAN_MS).getUTCDay()];
}

/** 'YYYY-MM-DD' -> 'DD.MM.YYYY' */
export function formatDatum(iso: string): string {
  const [g, m, d] = iso.split("-");
  return `${d}.${m}.${g}`;
}

/** 0 -> 'данас', 1 -> 'сутра', 5 -> 'за 5 дана', -1 -> 'јуче', -3 -> 'пре 3 дана' */
export function zaTekst(zaDana: number): string {
  if (zaDana === 0) return "данас";
  if (zaDana === 1) return "сутра";
  if (zaDana === -1) return "јуче";
  if (zaDana > 1) return `за ${zaDana} ${mnozinaDana(zaDana)}`;
  return `пре ${-zaDana} ${mnozinaDana(-zaDana)}`;
}

function mnozinaDana(n: number): string {
  const j = n % 10;
  const dj = n % 100;
  if (j === 1 && dj !== 11) return "дан";
  return "дана";
}
