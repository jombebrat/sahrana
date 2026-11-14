import { VAPID_JAVNI } from "./config";
import { sb } from "./sb";
import { b64uUBajtove, jeInstalirana, jeIOS } from "./util";

export type StanjeOb = "nepodrzano" | "instaliraj" | "iskljuceno" | "blokirano" | "ukljuceno";

export async function stanjeObavestenja(): Promise<StanjeOb> {
  if (jeIOS() && !jeInstalirana()) return "instaliraj";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "nepodrzano";
  }
  if (Notification.permission === "denied") return "blokirano";
  const reg = await navigator.serviceWorker.getRegistration();
  const pretplata = await reg?.pushManager.getSubscription();
  return pretplata && Notification.permission === "granted" ? "ukljuceno" : "iskljuceno";
}

/** Тражи дозволу (мора из додира на дугме), претплаћује телефон и чува претплату. */
export async function ukljuciObavestenja(): Promise<StanjeOb> {
  const dozvola = await Notification.requestPermission();
  if (dozvola !== "granted") return dozvola === "denied" ? "blokirano" : "iskljuceno";
  const reg = await navigator.serviceWorker.ready;
  let pretplata = await reg.pushManager.getSubscription();
  if (!pretplata) {
    pretplata = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64uUBajtove(VAPID_JAVNI) as BufferSource,
    });
  }
  const j = pretplata.toJSON();
  const { error } = await sb.from("push_pretplate").upsert(
    {
      endpoint: j.endpoint,
      p256dh: j.keys?.p256dh,
      auth: j.keys?.auth,
      uredjaj: navigator.userAgent.slice(0, 150),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
  return "ukljuceno";
}
