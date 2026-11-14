// Јавна подешавања. Кључ испод је „publishable“: сме да стоји у апликацији,
// а подаци су заштићени правилима у бази (види supabase/migrations).
export const SB_URL = "https://pxcrzrgukrueuduajipi.supabase.co";
export const SB_KLJUC = "sb_publishable__9i0yCN6ZBCIYP7f0qzXFg_wjjcAGCg";
export const FN = `${SB_URL}/functions/v1/parastosi`;
export const VAPID_JAVNI =
  "BOYJDWTcvHNzv6LfuaMJo_zSBawfWddTiJXBtmFNKlKvxlsnPXIBD9RlLWyrUB6k-yMnZrLJ4LuRDzor7B1M0bY";
export const EMAIL_VLASNIKA = "vlasnik@parastosi.invalid";

/** Само у развоју: ?demo приказује измишљене податке без пријаве. */
export const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
