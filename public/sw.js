// Service worker: обавештења и рад без интернета.
const KES = "parastosi-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== KES).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Фајлови апликације: прво мрежа, па кеш ако нема интернета.
self.addEventListener("fetch", (e) => {
  const zahtev = e.request;
  if (zahtev.method !== "GET" || new URL(zahtev.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(zahtev)
      .then((odg) => {
        if (odg.ok) {
          const kopija = odg.clone();
          caches.open(KES).then((c) => c.put(zahtev, kopija));
        }
        return odg;
      })
      .catch(() =>
        caches.match(zahtev, { ignoreSearch: zahtev.mode === "navigate" }).then((k) => k || Response.error())
      ),
  );
});

self.addEventListener("push", (e) => {
  let p = {};
  try {
    p = e.data ? e.data.json() : {};
  } catch (_) {
    p = { title: "Парастоси", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(p.title || "Парастоси", {
      body: p.body || "",
      tag: p.tag || undefined,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { url: p.url || self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((prozori) => {
      for (const p of prozori) {
        if (p.url.startsWith(self.registration.scope) && "focus" in p) {
          p.postMessage({ otvori: url });
          return p.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
