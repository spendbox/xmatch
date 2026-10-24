"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Someone you paid to message from Meet: you already saw their name and main photo there */
export type PaidChatPerson = { name: string | null; photo: string | null };

/** Masked chats you started by paying on Meet, by chat id. Empty until loaded (or if none). */
export function usePaidChatPeople(skip?: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [people, setPeople] = useState<Record<string, PaidChatPerson>>({});
  useEffect(() => {
    if (skip) return;
    supabase.rpc("paid_chat_people").then(({ data, error }) => {
      if (!error && data && typeof data === "object") setPeople(data as Record<string, PaidChatPerson>);
    });
  }, [supabase, skip]);
  return people;
}
