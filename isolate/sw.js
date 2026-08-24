/*
 * Service Worker — سامانه مدیریت سرویس مدرسه
 *
 * Deliberately conservative: network passthrough for all requests (the app is
 * Convex-reactive and the driver console keeps its own localStorage offline
 * queue, so HTTP-level caching would only risk stale hashed chunks). The SW
 * exists to (a) make the app installable as a PWA and (b) display incoming
 * Web Push notifications.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough — never serve from cache.
});

self.addEventListener("push", (event) => {
  let payload = { title: "اطلاع‌رسانی سرویس مدرسه", body: "" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || "",
      };
    }
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      dir: "rtl",
      lang: "fa",
      icon: "/logo.svg",
      badge: "/logo.svg",
      tag: "school-service",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/parent");
    }),
  );
});
