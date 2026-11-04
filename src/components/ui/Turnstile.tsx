"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
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

const FIELD = "cf-turnstile-response";
const WAIT_MS = 20_000; // longest we hold a tap while the check finishes
const RETRIES = 2; // a check that fails (bad signal) is tried again this many times

/**
 * Cloudflare's "are you human?" check. Usually invisible or a single tick.
 * Adds a hidden "cf-turnstile-response" field to the surrounding form.
 * If the form is sent before the check has finished (it can take a few seconds on a slow
 * connection), the tap waits for it and then sends, instead of failing the check.
 * Shows nothing if no site key is set.
 */
export function Turnstile() {
  const box = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!SITE_KEY || !el) return;
    let id: string | null = null;
    let alive = true;
    let tries = 0;
    let ready: (() => void) | null = null;
    const token = () => (el.querySelector(`input[name="${FIELD}"]`) as HTMLInputElement | null)?.value ?? "";

    loadScript()
      .then(() => {
        if (!alive || !window.turnstile) return;
        id = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          theme: "light",
          size: "flexible",
          appearance: "interaction-only",
          callback: () => ready?.(),
          // A failed check (often a dropped connection): try again quietly instead of leaving the form without one
          "error-callback": () => {
            if (alive && id && tries < RETRIES) {
              tries++;
              setTimeout(() => alive && id && window.turnstile?.reset(id), 1500);
            }
            return true;
          },
        });
      })
      .catch(() => {});

    const form = el.closest("form");
    function onSubmit(e: SubmitEvent) {
      if (!form || token() || !window.turnstile || !form.requestSubmit) return;
      // Not ready yet: hold this tap, and send it as soon as the check is done
      e.preventDefault();
      e.stopPropagation();
      if (ready) return;
      setWaiting(true);
      const submitter = e.submitter as HTMLElement | null;
      const timer = setTimeout(() => ready?.(), WAIT_MS);
      ready = () => {
        clearTimeout(timer);
        ready = null;
        setWaiting(false);
        // Past the wait, send anyway (the server then asks for a fresh check)
        if (alive && form.isConnected) {
          if (!token()) form.dataset.turnstileGiveUp = "1";
          form.requestSubmit(submitter && form.contains(submitter) ? (submitter as HTMLButtonElement) : undefined);
        }
      };
    }
    function onSubmitGate(e: SubmitEvent) {
      if (form?.dataset.turnstileGiveUp) return void delete form.dataset.turnstileGiveUp;
      onSubmit(e);
    }
    // Before React sees it (capture, on the form itself)
    form?.addEventListener("submit", onSubmitGate, true);
    return () => {
      alive = false;
      form?.removeEventListener("submit", onSubmitGate, true);
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);
  if (!SITE_KEY) return null;
  return (
    <>
      <div ref={box} className="min-h-0 [&:has(iframe)]:min-h-[65px]" />
      {waiting && <p className="text-center text-[13px] font-medium text-muted">Running a quick security check…</p>}
    </>
  );
}
