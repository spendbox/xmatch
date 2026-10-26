"use client";

import { pagePath, type SpeedSample } from "./speedLog";

/** About 1 visit in 3 is recorded (the whole visit, so the numbers stay fair) */
const SHARE = 0.3;
const KEY = "dp_speed_on";

let on: boolean | null = null;
let queue: SpeedSample[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function recording() {
  if (on !== null) return on;
  if (typeof window === "undefined") return (on = false);
  try {
    const saved = sessionStorage.getItem(KEY);
    on = saved ? saved === "1" : Math.random() < SHARE;
    sessionStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    on = Math.random() < SHARE;
  }
  return on;
}

function send() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ samples: queue.splice(0, 100) });
  // Still goes out when the page is closing
  if (!navigator.sendBeacon?.("/api/speed", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

/** Add one timing; they go to Dashpad together every 15 seconds (and when the page is left) */
export function recordSpeed(s: SpeedSample) {
  if (!recording()) return;
  queue.push({ ...s, p: s.p ? pagePath(s.p) : undefined });
  if (queue.length >= 100) send();
  else timer ??= setTimeout(send, 15_000);
}

export const currentPath = () => (typeof location === "undefined" ? undefined : location.pathname);

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", send);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send());
}
