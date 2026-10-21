"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Thin bar at the top of the screen while a new page is loading. */
export function NavProgress() {
  const path = usePathname();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDone(true);
    const t = setTimeout(() => {
      setActive(false);
      setDone(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setDone(false);
      setActive(true);
    }
    function onStart() {
      setDone(false);
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("dashpad:navigate", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("dashpad:navigate", onStart);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className={
          "h-full origin-left bg-gradient-to-r from-brand via-[#9b7bff] to-gold " +
          (done ? "scale-x-100 opacity-0 transition-all duration-300" : "animate-progress")
        }
      />
    </div>
  );
}

/** Call before a programmatic page change to show the loading bar. */
export function startNavProgress() {
  window.dispatchEvent(new Event("dashpad:navigate"));
}
