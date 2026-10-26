"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Someone counts as online if the app checked in within this time (it checks in every minute while open,
 * and says when you leave). The database uses the same 150 seconds everywhere (update 88). */
export const ONLINE_MS = 2.5 * 60 * 1000;

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

/** When each of these people was last in the app, refreshed every 30 seconds (the same check on every screen). */
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
      // Anyone the app shows you (update 88). Before that runs, only people you've matched with.
      // (100 at a time)
      const batches = await Promise.all(
        Array.from({ length: Math.ceil(list.length / 100) }, (_, i) => supabase.rpc("presence", { p_ids: list.slice(i * 100, i * 100 + 100) })),
      );
      const failed = batches.some((b) => b.error);
      const rows = failed ? (await supabase.from("profiles").select("id, last_seen_at").in("id", list)).data : batches.flatMap((b) => b.data ?? []);
      if (!alive || !rows) return;
      const found = Object.fromEntries((rows as { id: string; last_seen_at: string | null }[]).map((r) => [r.id, r.last_seen_at ?? ""]));
      // Someone it didn't return isn't shown as online (an older list's "online" could be minutes out of date)
      setSeen(failed ? found : { ...Object.fromEntries(list.map((id) => [id, ""])), ...found });
      setNow(Date.now());
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
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
