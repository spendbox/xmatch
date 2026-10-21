"use client";

import { useEffect } from "react";

/** Always open the landing page at the top (e.g. after logging out from the bottom of a page). */
export function ScrollToTop() {
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return null;
}
