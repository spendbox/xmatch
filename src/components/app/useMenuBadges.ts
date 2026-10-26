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
/** Fired when one of your chats changes (a new message), so lists on screen can refresh */
export const CHATS_EVENT = "dp:chats";

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
    // One request for everything (update 95); before that runs, the five separate ones
    type All = { chats?: number; event_chats?: number; feed_chats?: number; masked?: number; event?: unknown };
    const one = await supabase.rpc("menu_badges");
    const all = one.error ? null : (one.data as All | null);
    const wrap = (data: unknown) => ({ data, error: null });
    const [chats, eventChats, event, feedChats, masked] = all
      ? [wrap(all.chats), wrap(all.event_chats), wrap(all.event), wrap(all.feed_chats), wrap(all.masked)]
      : await Promise.all([
          supabase.rpc("unread_chats"),
          supabase.rpc("unread_event_chats"),
          supabase.rpc("next_event"),
          supabase.rpc("unread_feed_chats"),
          supabase.rpc("unread_masked_chats"),
        ]);
    const ev = event.data as { i_am_going?: boolean; starts_at?: string; ends_at?: string } | null;
    const now = Date.now();
    const eventLive =
      !!ev?.i_am_going && !!ev.starts_at && !!ev.ends_at && new Date(ev.starts_at).getTime() <= now && new Date(ev.ends_at).getTime() > now;
    const num = (x: unknown) => (typeof x === "number" ? x : 0);
    const n = num(chats.data) + num(eventChats.data) + num(feedChats.data) + num(masked.data);
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

  // Moving between pages re-checks at most every 30 seconds (new messages arrive live anyway)
  const lastPathCheck = useRef(0);
  useEffect(() => {
    if (Date.now() - lastPathCheck.current < 30_000) return;
    lastPathCheck.current = Date.now();
    soon();
  }, [path, soon]);

  useEffect(() => {
    // A chat changed (a message arrived or was sent): update the dots, and tell lists on screen (Home, Chats)
    const changed = () => {
      soon();
      window.dispatchEvent(new Event(CHATS_EVENT));
    };
    const ch = supabase
      .channel(`badges-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      // Only rows that are yours: a new message bumps its chat's last_message_at, so watching
      // your own chats is enough (watching every message on Dashpad costs a lot as we grow)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_a=eq.${userId}` }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_b=eq.${userId}` }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_a=eq.${userId}` }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_b=eq.${userId}` }, changed)
      // Masked chats: one small row per person, touched on every message (update 65)
      .on("postgres_changes", { event: "*", schema: "public", table: "masked_activity", filter: `user_id=eq.${userId}` }, changed)
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
