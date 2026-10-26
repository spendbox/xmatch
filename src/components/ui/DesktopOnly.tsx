"use client";

import { useEffect, useState } from "react";

/** Shows its content only on computers (lg and up), so phones don't load what they'd never see */
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return wide ? <>{children}</> : null;
}
