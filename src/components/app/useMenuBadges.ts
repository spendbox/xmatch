"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type MenuBadges = { chats: number; eventLive: boolean };

/** Tell the menu to re-check (e.g. after a chat was opened and read). */
export function refreshMenuBadges() {
  window.dispatchEvent(new Event("dp:badges"));
}

/** Dots on the menu: unread chats, and an event you're going to that's live now. */
export function useMenuBadges(userId: string): MenuBadges {
  const supabase = useMemo(() => createClient(), []);
  const path = usePathname();
  const [badges, setBadges] = useState<MenuBadges>({ chats: 0, eventLive: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const [chats, event] = await Promise.all([supabase.rpc("unread_chats"), supabase.rpc("next_event")]);
    const ev = event.data as { i_am_going?: boolean; starts_at?: string; ends_at?: string } | null;
    const now = Date.now();
    const eventLive =
      !!ev?.i_am_going && !!ev.starts_at && !!ev.ends_at && new Date(ev.starts_at).getTime() <= now && new Date(ev.ends_at).getTime() > now;
    setBadges((b) => ({ chats: typeof chats.data === "number" ? chats.data : b.chats, eventLive }));
  }, [supabase]);

  // Wait a moment so a burst of messages only triggers one check
  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 600);
  }, [refresh]);

  useEffect(() => {
    soon();
  }, [path, soon]);

  useEffect(() => {
    const ch = supabase
      .channel(`badges-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, soon)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, soon)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && soon();
    window.addEventListener("dp:badges", soon);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const every = setInterval(soon, 60_000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("dp:badges", soon);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(every);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [supabase, userId, soon]);

  return badges;
}
