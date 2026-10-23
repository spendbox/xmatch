"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Lets Dashpad know you're online, so Masquerade pop-ups only go to people who are here. */
export function useHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let last = 0;
    // Once a minute while the app is open (and not again within 20s when you flip back to it)
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 20_000) return;
      last = Date.now();
      supabase.rpc("heartbeat").then(() => {});
    };
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
