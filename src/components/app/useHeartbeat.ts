"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Lets Dashpad know you're online (once a minute while the app is open), and that you've
 * left as soon as you close it or switch away, so others see it straight away.
 */
export function useHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let last = 0;
    let token: string | null = null;
    let away = false;
    const keepToken = () =>
      supabase.auth.getSession().then(({ data }) => {
        token = data.session?.access_token ?? null;
      });

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      // Back from being away: check in now, even if it's only been a few seconds
      if (!away && Date.now() - last < 20_000) return;
      away = false;
      last = Date.now();
      supabase.rpc("heartbeat").then(() => {});
      void keepToken();
    };

    // Leaving: this has to work while the page is closing, so it's a plain request that may outlive the page
    const leave = () => {
      if (away || !token) return;
      away = true;
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/went_away`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch(() => {});
    };
    const onVisibility = () => (document.visibilityState === "visible" ? beat() : leave());

    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
}
