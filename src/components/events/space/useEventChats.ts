"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventChatSummary } from "@/lib/events";

/** Your private chats at an event, kept fresh as messages and decisions come in. */
export function useEventChats(eventId: string, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState<EventChatSummary[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("my_event_chats", { p_event: eventId });
    if (data) setChats(data as EventChatSummary[]);
  }, [supabase, eventId]);

  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 700);
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const ch = supabase
      .channel(`event-chats-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_chats", filter: `event_id=eq.${eventId}` }, soon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_chats", filter: `event_id=eq.${eventId}` }, soon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_chats" }, soon)
      .subscribe();
    const every = setInterval(() => document.visibilityState === "visible" && refresh(), 2 * 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(every);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, supabase, eventId, refresh, soon]);

  return { chats, setChats, refresh };
}
