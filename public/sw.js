// Dashpad background helper: shows push notifications and opens the right page when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Dashpad", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Dashpad";
  event.waitUntil(
    (async () => {
      // Already looking at that chat? No need to buzz (iPhones always need a notification shown)
      const ios = /iPhone|iPad|iPod/.test(self.navigator.userAgent);
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = wins.filter((w) => w.visibilityState === "visible");
      // Dashpad is open: it plays its own chime
      open.forEach((w) => w.postMessage({ type: "dp-push" }));
      if (data.url && !ios) {
        const target = new URL(data.url, self.location.origin).href;
        if (open.some((w) => w.url === target)) return;
      }
      return self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: "/badge-96.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      // Play the phone's notification sound (and again when a chat's notification updates);
      // while Dashpad is open on screen its own chime plays instead, so you don't hear two
      silent: open.length > 0,
      requireInteraction: !!data.requireInteraction,
      vibrate: data.requireInteraction ? [400, 200, 400, 200, 400] : [120, 60, 120],
      data: { url: data.url || "/home" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/home", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) return w.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
