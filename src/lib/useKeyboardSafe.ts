"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a full-screen chat exactly the size of the visible screen on phones,
 * so the typing box sits just above the keyboard instead of behind it.
 * Phones report the space left after the keyboard opens through
 * window.visualViewport; we pin the chat to that area.
 */
export function useKeyboardSafe<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const phone = window.matchMedia("(max-width: 1023px)");
    let lastHeight = 0;

    const apply = () => {
      if (!phone.matches) {
        el.style.height = "";
        el.style.top = "";
        return;
      }
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
      // When the keyboard opens, keep the latest messages in view
      if (lastHeight && vv.height < lastHeight - 80) {
        const list = el.querySelector<HTMLElement>("[data-chat-scroll]");
        if (list) list.scrollTop = list.scrollHeight;
      }
      lastHeight = vv.height;
    };

    // Stop the page itself from scrolling behind the chat
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    phone.addEventListener("change", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      phone.removeEventListener("change", apply);
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      el.style.height = "";
      el.style.top = "";
    };
  }, [el]);

  // Use as a callback ref: <div ref={shell}>
  return setEl;
}
