"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MeetChat, MeetList } from "@/lib/meets";

/** Meets for you (and your own), kept fresh while the page is open */
export function useMeets(initial: MeetList | null, { chats = false, initialChats = null }: { chats?: boolean; initialChats?: MeetChat[] | null } = {}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<MeetList | null>(initial);
  const [myChats, setMyChats] = useState<MeetChat[] | null>(initialChats);

  const refresh = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase.rpc("list_meets", { p_limit: 30 }),
      chats ? supabase.rpc("my_meet_chats") : Promise.resolve({ data: null }),
    ]);
    if (l.data) setList(l.data as MeetList);
    if (chats && c.data) setMyChats(c.data as MeetChat[]);
  }, [supabase, chats]);

  useEffect(() => {
    if (!initial || chats) refresh();
    const onFocus = () => document.visibilityState === "visible" && refresh();
    const every = setInterval(onFocus, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(every);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return { list, myChats, refresh };
}
