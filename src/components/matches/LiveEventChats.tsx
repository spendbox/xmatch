"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sexLabel } from "@/lib/eventSpace";
import { BlurPhoto } from "@/components/events/space/common";
import { MaskAvatar } from "@/components/feed/MaskAvatar";
import { timeLeft, type FeedChatSummary } from "@/lib/feed";

type LiveChat = {
  id: string;
  event_id: string;
  event_title: string;
  ends_at: string;
  name: string;
  age: number | null;
  gender: string | null;
  blur: string | null;
  photo: string | null;
  last_message: string | null;
  unread: boolean;
};

/** Chats you have going at an event right now, with a way back in. Shown at the top of Chats. */
export function LiveEventChats({ compact, divided, userId }: { compact?: boolean; divided?: boolean; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState<LiveChat[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_live_event_chats");
    if (Array.isArray(data)) setChats(data as LiveChat[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`live-event-chats-${Math.random().toString(36).slice(2)}`)
      // Your own event chats only; each new message bumps the chat row
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_a=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_chats", filter: `user_b=eq.${userId}` }, () => load())
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [supabase, load, userId]);

  if (!chats.length) return null;
  const now = Date.now();
  return (
    <section className={divided ? "mt-2 border-y border-line py-5" : compact ? "mt-5" : "mt-6"}>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <CalendarDays size={16} className="text-brand" /> From Events
      </h2>
      <ul className="space-y-2.5">
        {chats.map((c) => {
          const over = new Date(c.ends_at).getTime() <= now;
          return (
            <li key={c.id}>
              <Link
                href={`/events/${c.event_id}/chat/${c.id}`}
                className={clsx(
                  "flex items-center gap-3 rounded-3xl border p-3 pr-3.5 shadow-card transition active:scale-[0.98]",
                  c.unread ? "border-brand bg-brand-soft/50" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="relative shrink-0">
                  <BlurPhoto blur={c.blur} photo={c.photo} alt={c.name} soft className="h-12 w-12 rounded-full" />
                  {c.unread && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-chili ring-2 ring-surface" aria-label="New messages" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {c.name}
                    {c.age ? <span className="font-normal text-muted">, {c.age}</span> : null}
                    {sexLabel(c.gender) && <span className="font-normal text-muted"> · {sexLabel(c.gender)}</span>}
                  </p>
                  <p className={clsx("truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-muted")}>
                    {c.last_message ?? "Say hi"}
                  </p>
                  <p className="truncate text-[11px] font-medium text-brand">
                    {c.event_title} · {over ? "Decide: keep or let go" : "Live"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">
                  Open <ChevronRight size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Your 24-hour chats from the Feed. Shown in Chats under the event chats. */
export function LiveFeedChats({ compact, divided, userId }: { compact?: boolean; divided?: boolean; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState<FeedChatSummary[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_feed_chats");
    if (Array.isArray(data)) setChats(data as FeedChatSummary[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`live-feed-chats-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_a=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_chats", filter: `user_b=eq.${userId}` }, () => load())
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [supabase, load, userId]);

  if (!chats.length) return null;
  const now = Date.now();
  return (
    <section className={divided ? "border-b border-line py-5" : compact ? "mt-5" : "mt-6"}>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Sparkles size={16} className="text-brand" /> From the Feed
      </h2>
      <ul className="space-y-2.5">
        {chats.map((c) => {
          const left = new Date(c.expires_at).getTime() - now;
          return (
            <li key={c.id}>
              <Link
                href={`/feed/chat/${c.id}`}
                className={clsx(
                  "flex items-center gap-3 rounded-3xl border p-3 pr-3.5 shadow-card transition active:scale-[0.98]",
                  c.unread ? "border-brand bg-brand-soft/50" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="relative shrink-0">
                  <MaskAvatar alias={c.other.name} photo={c.other.masked ? null : c.other.photo} size={48} />
                  {c.unread && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-chili ring-2 ring-surface" aria-label="New messages" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {c.other.name}
                    {c.other.age ? <span className="font-normal text-muted">, {c.other.age}</span> : null}
                    {sexLabel(c.other.gender) && <span className="font-normal text-muted"> · {sexLabel(c.other.gender)}</span>}
                  </p>
                  <p className={clsx("truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-muted")}>{c.last_message ?? "Say hi"}</p>
                  <p className="truncate text-[11px] font-medium text-brand">{left > 0 ? timeLeft(left) : "Decide: keep or let go"}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">
                  Open <ChevronRight size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
