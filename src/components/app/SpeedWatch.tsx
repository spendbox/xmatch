"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordSpeed } from "@/lib/speedClient";
import { pagePath } from "@/lib/speedLog";

/**
 * For the speed log (Admin → Speed): how long pages take to open. "first load" is opening Dashpad
 * on a page (until it shows); "open" is tapping through to another page (until it shows).
 */
export function SpeedWatch() {
  const path = usePathname();
  const tapped = useRef<number | null>(null);
  const first = useRef(true);

  // Opening Dashpad: from asking for the page until it's on screen
  useEffect(() => {
    const done = () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      recordSpeed({ k: "page", n: `${pagePath(location.pathname)} · server`, ms: Math.round(nav.responseStart - nav.requestStart), ok: true, p: location.pathname });
      recordSpeed({ k: "page", n: `${pagePath(location.pathname)} · first load`, ms: Math.round(nav.domContentLoadedEventEnd || performance.now()), ok: true, p: location.pathname });
    };
    if (document.readyState === "complete") setTimeout(done, 0);
    else window.addEventListener("load", () => setTimeout(done, 0), { once: true });
  }, []);

  // Tapping a link inside Dashpad starts the clock
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || e.defaultPrevented) return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) tapped.current = performance.now();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // …and the new page showing stops it (the next frame after it's on screen)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t0 = tapped.current;
    tapped.current = null;
    if (t0 === null) return;
    requestAnimationFrame(() => recordSpeed({ k: "page", n: `${pagePath(path)} · open`, ms: Math.round(performance.now() - t0), ok: true, p: path }));
  }, [path]);

  return null;
}
