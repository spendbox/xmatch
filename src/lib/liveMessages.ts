"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Live chat messages, through each chat's own channel ("broadcast", database update 121).
 * Who may listen is checked once when the chat opens, instead of for every message and every
 * listener, which is what keeps it light with lots of people chatting.
 *
 * Until update 121 has run, or if a chat's channel can't be joined, it listens the old way
 * (database changes) instead, so messages always arrive.
 */

// New and changed messages (deleting a message for everyone is a change: it sets deleted_at)
type Op = "INSERT" | "UPDATE";
export type RowChange<T> = { eventType: Op; new: T; old: Partial<T> };

/** Each table's channel: the name's start and the column that says which chat (same as update 121) */
const TABLES = {
  messages: { prefix: "match", column: "match_id" },
  masquerade_messages: { prefix: "room", column: "session_id" },
  event_chat_messages: { prefix: "event-chat", column: "chat_id" },
  feed_chat_messages: { prefix: "feed-chat", column: "chat_id" },
  event_room_messages: { prefix: "event-room", column: "event_id" },
} as const;
export type LiveTable = keyof typeof TABLES;

let ready: Promise<boolean> | null = null;
/** Has update 121 run? (Asked once per visit) */
function broadcastReady(supabase: SupabaseClient) {
  ready ??= Promise.resolve(supabase.rpc("live_broadcast_ready")).then(
    ({ data, error }) => !error && data === true,
    () => false,
  );
  return ready;
}

type Listener = { events: Op[]; onChange: (c: RowChange<unknown>) => void };
type Shared = { supabase: SupabaseClient; listeners: Set<Listener>; channel: RealtimeChannel | null; closed: boolean };

// One channel per chat, shared by every screen showing it (e.g. a chat and its game panel)
const open = new Map<string, Shared>();

function tell(shared: Shared, eventType: Op, row: unknown, old: unknown) {
  for (const l of shared.listeners) if (l.events.includes(eventType)) l.onChange({ eventType, new: row, old: (old ?? {}) as object });
}

const ALL: Op[] = ["INSERT", "UPDATE"];

function listenOldWay(supabase: SupabaseClient, shared: Shared, table: LiveTable, id: string) {
  if (shared.closed) return;
  const { prefix, column } = TABLES[table];
  let ch = supabase.channel(`db-${prefix}-${id}-${Math.random().toString(36).slice(2)}`);
  for (const ev of ALL) {
    ch = ch.on("postgres_changes", { event: ev, schema: "public", table, filter: `${column}=eq.${id}` }, (p) =>
      tell(shared, ev, p.new, p.old),
    );
  }
  shared.channel = ch.subscribe();
}

async function start(supabase: SupabaseClient, shared: Shared, table: LiveTable, id: string) {
  const ok = await broadcastReady(supabase);
  if (shared.closed) return;
  if (!ok) return listenOldWay(supabase, shared, table, id);
  // The channel checks who you are, so it needs your sign-in
  try {
    await supabase.realtime.setAuth();
  } catch {}
  if (shared.closed) return;
  const { prefix } = TABLES[table];
  let ch = supabase.channel(`${prefix}:${id}`, { config: { private: true } });
  for (const ev of ALL) {
    ch = ch.on("broadcast", { event: ev }, (msg) => {
      const p = (msg?.payload ?? {}) as { record?: unknown; old_record?: unknown };
      if (p.record || p.old_record) tell(shared, ev, p.record ?? p.old_record, p.old_record);
    });
  }
  let switched = false;
  shared.channel = ch.subscribe((status) => {
    // Couldn't join (e.g. a setting in Supabase): listen the old way instead
    if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !switched && !shared.closed) {
      switched = true;
      void supabase.removeChannel(ch);
      listenOldWay(supabase, shared, table, id);
    }
  });
}

/**
 * Listen to one chat's messages. `onChange` gets the same shape as database changes:
 * { eventType, new, old }. Returns a function that stops listening.
 */
export function listenMessages<T>(
  supabase: SupabaseClient,
  table: LiveTable,
  id: string,
  events: Op[],
  onChange: (c: RowChange<T>) => void,
): () => void {
  const key = `${table}:${id}`;
  let shared = open.get(key);
  if (!shared) {
    shared = { supabase, listeners: new Set(), channel: null, closed: false };
    open.set(key, shared);
    void start(supabase, shared, table, id);
  }
  const me: Listener = { events, onChange: onChange as (c: RowChange<unknown>) => void };
  shared.listeners.add(me);
  const s = shared;
  return () => {
    s.listeners.delete(me);
    if (s.listeners.size) return;
    // Nobody's showing this chat any more
    s.closed = true;
    open.delete(key);
    if (s.channel) void s.supabase.removeChannel(s.channel);
  };
}
