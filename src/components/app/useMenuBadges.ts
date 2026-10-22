"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type MenuBadges = {
  chats: number;
  eventLive: boolean;
  /** Today's prompt is up and you haven't answered */
  feedNew: boolean;
  /** Gifts on your answers you haven't seen */
  feedGifts: number;
};

/** The same badges, for parts of a page (e.g. the Home tabs) */
export const MenuBadgesContext = createContext<MenuBadges | undefined>(undefined);
export const useMenuBadgesContext = () => useContext(MenuBadgesContext);

/** Tell the menu to re-check (e.g. after a chat was opened and read). */
export function refreshMenuBadges() {
  window.dispatchEvent(new Event("dp:badges"));
}

/** Dots on the menu: unread chats, an event you're going to that's live now, and the Feed. */
export function useMenuBadges(userId: string): MenuBadges {
  const supabase = useMemo(() => createClient(), []);
  const path = usePathname();
  const [badges, setBadges] = useState<MenuBadges>({ chats: 0, eventLive: false, feedNew: false, feedGifts: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const [chats, eventChats, event, feedChats] = await Promise.all([
      supabase.rpc("unread_chats"),
      supabase.rpc("unread_event_chats"),
      supabase.rpc("next_event"),
      supabase.rpc("unread_feed_chats"),
    ]);
    const ev = event.data as { i_am_going?: boolean; starts_at?: string; ends_at?: string } | null;
    const now = Date.now();
    const eventLive =
      !!ev?.i_am_going && !!ev.starts_at && !!ev.ends_at && new Date(ev.starts_at).getTime() <= now && new Date(ev.ends_at).getTime() > now;
    const num = (x: unknown) => (typeof x === "number" ? x : 0);
    const n = num(chats.data) + num(eventChats.data) + num(feedChats.data);
    setBadges((b) => ({
      chats: chats.error && eventChats.error ? b.chats : n,
      eventLive,
      // The Feed is hidden for now
      feedNew: false,
      feedGifts: 0,
    }));
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
      // Only rows that are yours: a new message bumps its chat's last_message_at, so watching
      // your own chats is enough (watching every message on Dashpad costs a lot as we grow)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_a=eq.${userId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_b=eq.${userId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_a=eq.${userId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_b=eq.${userId}` }, soon)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && soon();
    window.addEventListener("dp:badges", soon);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const every = setInterval(() => document.visibilityState === "visible" && soon(), 5 * 60_000);
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
