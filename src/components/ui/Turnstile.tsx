"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
let loading: Promise<void> | null = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject();
      document.head.appendChild(s);
    });
  }
  return loading;
}

/**
 * Cloudflare's "are you human?" check. Usually invisible or a single tick.
 * Adds a hidden "cf-turnstile-response" field to the surrounding form.
 * Shows nothing if no site key is set.
 */
export function Turnstile() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, { sitekey: SITE_KEY, theme: "light", size: "flexible", appearance: "interaction-only" });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);
  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-0 [&:has(iframe)]:min-h-[65px]" />;
}
