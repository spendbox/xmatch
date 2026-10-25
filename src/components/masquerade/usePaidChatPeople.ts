"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Someone you paid to message from Meet: you already saw their name and main photo there */
export type PaidChatPerson = {
  /** Their id, so you can open their profile (only when you can see who they are) */
  id?: string;
  name: string | null;
  photo: string | null;
  /** true: you paid and can see their name. false: they paid to message you, so they can see yours */
  started_by_me?: boolean;
  /** You both waved: you can both see each other's names */
  waved?: boolean;
  /** You paid: when your Keys come back if they never reply (null once they have, or if it was free) */
  refund_at?: string | null;
  refunded?: boolean;
  paid_keys?: number;
};

/** Masked chats someone paid to start on Meet (you or them), by chat id. Empty until loaded (or if none). */
export function usePaidChatPeople(skip?: boolean, initial?: Record<string, PaidChatPerson>) {
  const supabase = useMemo(() => createClient(), []);
  const [people, setPeople] = useState<Record<string, PaidChatPerson>>(initial ?? {});
  useEffect(() => {
    if (skip) return;
    supabase.rpc("paid_chat_people").then(({ data, error }) => {
      if (!error && data && typeof data === "object") setPeople(data as Record<string, PaidChatPerson>);
    });
  }, [supabase, skip]);
  return people;
}
