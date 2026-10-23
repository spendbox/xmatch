"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Sticks to the top of the screen while you scroll. Once it's stuck it turns
 * frosted and gets a soft shadow, so the page slides underneath it cleanly.
 * It stays the same size either way, so nothing jumps.
 */
export function Sticky({
  children,
  className,
  bleed = "-mx-5 px-5 lg:-mx-10 lg:px-10",
}: {
  children: React.ReactNode;
  className?: string;
  /** Matches the page's side padding, so the frosted band reaches the edges */
  bleed?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-0" />
      <div
        data-stuck={stuck || undefined}
        className={clsx(
          "sticky top-[env(safe-area-inset-top)] z-30 py-2.5",
          bleed,
          // Covers the notch area above it too
          "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-inherit",
          "transition-[background-color,box-shadow] duration-200",
          stuck ? "bg-cream/85 shadow-[0_12px_24px_-20px_rgba(28,24,40,0.55)] backdrop-blur-xl backdrop-saturate-150" : "bg-cream/0",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
