"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top the moment you tap a link, until the new page shows. Without it a
 * tap that has to wait on the server looks like nothing happened. Pages that open instantly
 * never show it (it waits a tenth of a second first).
 */
export function NavProgress() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const [going, setGoing] = useState(false);
  const [shown, setShown] = useState(false);

  // The new page is showing: done
  useEffect(() => {
    setGoing(false);
    setShown(false);
  }, [path, query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setGoing(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!going) return;
    const show = setTimeout(() => setShown(true), 100);
    // Never stuck: give up after a while
    const stop = setTimeout(() => setGoing(false), 20000);
    return () => {
      clearTimeout(show);
      clearTimeout(stop);
    };
  }, [going]);

  if (!going || !shown) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div className="h-full origin-left animate-progress bg-brand shadow-[0_0_8px_rgba(109,79,240,0.7)]" />
    </div>
  );
}
