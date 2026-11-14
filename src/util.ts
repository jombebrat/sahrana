const CIR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j", к: "k",
  л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "c", у: "u",
  ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
};

/** За претрагу: ћирилица и латиница, са и без квачица, дају исти текст. */
export function zaPretragu(s: string): string {
  let r = "";
  for (const z of s.toLowerCase()) r += CIR[z] ?? z;
  return r
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Број за wa.me: само цифре, француски 0X… постаје 33X… */
export function zaWhatsApp(tel: string): string {
  let c = tel.replace(/\D/g, "");
  if (c.startsWith("00")) c = c.slice(2);
  else if (c.length === 10 && c.startsWith("0")) c = "33" + c.slice(1);
  return c;
}

export function zaPoziv(tel: string): string {
  const t = tel.trim();
  return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
}

export function noviToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64uUBajtove(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(p);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const jeIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const jeInstalirana = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const MESECI = [
  "јануар", "фебруар", "март", "април", "мај", "јун",
  "јул", "август", "септембар", "октобар", "новембар", "децембар",
];
/** '2026-11-14' -> '14. новембар 2026.' */
export function dugDatum(iso: string): string {
  const [g, m, d] = iso.split("-").map(Number);
  return `${d}. ${MESECI[m - 1]} ${g}.`;
}
