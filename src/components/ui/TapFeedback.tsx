"use client";

import { useEffect } from "react";

const PRESSABLE = 'button, [role="button"], a[href], summary, label:has(> input[type="file"])';
// Games and drag handles have their own feel
const SKIP = "[data-no-press], .gm-btn, .gm-board";
const MIN_PRESS = 110; // ms; a quick tap still shows
const BUSY_AFTER = 120; // ms; fast replies don't flicker
const TAP_WINDOW = 1500; // ms; requests started this soon after a tap belong to it

function pressable(target: EventTarget | null) {
  const el = (target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
  if (!el || el.closest(SKIP) || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  return el;
}

/**
 * App-wide tap feedback: whatever you tap dips slightly right away, and if the tap starts
 * work on the server (saving, sending, loading), it gently pulses until the work is done.
 */
export function TapFeedback() {
  useEffect(() => {
    let pressed: HTMLElement | null = null;
    let pressedAt = 0;
    let lastTap: HTMLElement | null = null;
    let lastTapAt = 0;
    const pending = new Map<HTMLElement, number>();

    function press(e: PointerEvent) {
      if (e.button !== 0) return;
      const el = pressable(e.target);
      if (!el) return;
      release(true);
      const w = el.getBoundingClientRect().width;
      // Big cards dip less than small buttons
      el.style.setProperty("--dp-press", w > 320 ? "0.985" : w > 160 ? "0.975" : "0.95");
      el.setAttribute("data-pressed", "");
      pressed = el;
      pressedAt = performance.now();
      lastTap = el;
      lastTapAt = pressedAt;
    }
    function release(now = false) {
      const el = pressed;
      if (!el) return;
      pressed = null;
      const left = now ? 0 : Math.max(0, MIN_PRESS - (performance.now() - pressedAt));
      setTimeout(() => el.removeAttribute("data-pressed"), left);
    }
    const up = () => release();
    function click(e: MouseEvent) {
      // Keyboard and screen readers click without a pointer
      const el = pressable(e.target);
      if (el) {
        lastTap = el;
        lastTapAt = performance.now();
      }
    }

    const original = window.fetch;
    function begin(el: HTMLElement) {
      const n = (pending.get(el) ?? 0) + 1;
      pending.set(el, n);
      if (n === 1) {
        const t = window.setTimeout(() => pending.get(el) && el.isConnected && el.setAttribute("data-busy", ""), BUSY_AFTER);
        el.dataset.dpBusyTimer = String(t);
      }
    }
    function end(el: HTMLElement) {
      const n = (pending.get(el) ?? 1) - 1;
      if (n > 0) return void pending.set(el, n);
      pending.delete(el);
      clearTimeout(Number(el.dataset.dpBusyTimer));
      delete el.dataset.dpBusyTimer;
      el.removeAttribute("data-busy");
    }
    const tracked: typeof fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
      const el = lastTap && performance.now() - lastTapAt < TAP_WINDOW && lastTap.isConnected ? lastTap : null;
      const p = original.apply(this, args);
      if (el) {
        begin(el);
        p.then(() => end(el), () => end(el));
      }
      return p;
    };
    window.fetch = tracked;

    document.addEventListener("pointerdown", press, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("dragstart", up, true);
    document.addEventListener("click", click, true);
    window.addEventListener("blur", up);
    return () => {
      if (window.fetch === tracked) window.fetch = original;
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("dragstart", up, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener("blur", up);
    };
  }, []);
  return null;
}
