"use client";

/**
 * Stops the page behind a pop-up from scrolling. Everything that needs it shares
 * one count, so the page always unfreezes when the last one closes, whatever
 * order they open and close in. (Each one remembering the page's previous state
 * could leave it frozen until a refresh.)
 */
let count = 0;

export function lockScroll() {
  count += 1;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    apply();
  };
}

function apply() {
  if (typeof document === "undefined") return;
  const v = count > 0 ? "hidden" : "";
  document.body.style.overflow = v;
  document.documentElement.style.overflow = v;
}
