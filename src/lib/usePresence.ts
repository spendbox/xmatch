"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Someone counts as online if the app checked in within this time (it checks in every 45s while open). */
export const ONLINE_MS = 2 * 60 * 1000;

export function isOnline(lastSeen?: string | null, now = Date.now()) {
  return !!lastSeen && now - new Date(lastSeen).getTime() < ONLINE_MS;
}

export function lastSeenText(lastSeen?: string | null, now = Date.now()) {
  if (!lastSeen) return "Offline";
  const ms = now - new Date(lastSeen).getTime();
  if (ms < ONLINE_MS) return "Online";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `Last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Last seen ${d}d ago`;
  return "Offline";
}

/** When each of these people (your matches) was last in the app, refreshed every minute. */
export function usePresence(ids: string[]) {
  const supabase = useMemo(() => createClient(), []);
  const key = [...new Set(ids)].sort().join(",");
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("id, last_seen_at").in("id", list);
      if (!alive || !data) return;
      setSeen(Object.fromEntries(data.map((r) => [r.id as string, r.last_seen_at as string])));
      setNow(Date.now());
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, key]);

  return { seen, now };
}
