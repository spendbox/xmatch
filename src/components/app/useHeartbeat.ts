"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Lets Dashpad know you're online, so Masquerade pop-ups only go to people who are here. */
export function useHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    const beat = () => {
      if (document.visibilityState === "visible") supabase.rpc("heartbeat").then(() => {});
    };
    beat();
    const t = setInterval(beat, 45_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
