"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Megaphone, MessageSquareOff, SendHorizontal, Sparkles, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HYPE_REACTIONS, type EventSettings, type RoomMessage } from "@/lib/events";
import { eventError, nameColor } from "@/lib/eventSpace";
import { tapFeedback } from "@/components/ui/Button";

type Burst = { id: number; emoji: string; dx: number; left: number };

/** Everyone at the event: live chat, hype reactions and moments from Dashpad. */
export function Room({
  eventId,
  userId,
  settings: s,
  names,
  live,
  className,
}: {
  eventId: string;
  userId: string;
  settings: Required<EventSettings>;
  /** First names we already know (from the wall), by user id */
  names: Map<string, string>;
  live: boolean;
  className?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<RoomMessage[] | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [clock, setClock] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastHype = useRef(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const namesRef = useRef(names);
  namesRef.current = names;

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("room_messages", { p_event: eventId });
    if (data) setMessages(data as RoomMessage[]);
  }, [supabase, eventId]);

  const burst = useCallback((emoji: string) => {
    const b: Burst = { id: Math.random(), emoji, dx: Math.round(Math.random() * 80 - 40), left: Math.round(55 + Math.random() * 35) };
    setBursts((l) => [...l.slice(-23), b]);
    setTimeout(() => setBursts((l) => l.filter((x) => x.id !== b.id)), 2500);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`room-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_room_messages", filter: `event_id=eq.${eventId}` }, (p) => {
        const m = p.new as Omit<RoomMessage, "name">;
        if (m.kind === "hype") {
          if (m.user_id !== userId) burst(m.body);
          return;
        }
        const name = m.user_id ? (m.user_id === userId ? "You" : namesRef.current.get(m.user_id) ?? "") : "Dashpad";
        setMessages((l) => {
          const cur = l ?? [];
          if (cur.some((x) => x.id === m.id)) return cur;
          // Replace my own draft with the saved one
          const withoutDraft = m.user_id === userId ? cur.filter((x) => !(x.id < 0 && x.body === m.body)) : cur;
          return [...withoutDraft, { ...m, name }].slice(-200);
        });
        if (!name) {
          // Someone we don't know yet: fetch the room again for their name
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(load, 1200);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [supabase, eventId, userId, load, burst]);

  // Keep the newest message in view unless they've scrolled up to read
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Slow-mode countdown
  const waitLeft = Math.max(0, Math.ceil((cooldownUntil - clock) / 1000));
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    setClock(Date.now());
    const t = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || waitLeft > 0) return;
    tapFeedback();
    setText("");
    stick.current = true;
    const draft: RoomMessage = { id: -Date.now(), user_id: userId, kind: "text", body, created_at: new Date().toISOString(), name: "You" };
    setMessages((l) => [...(l ?? []), draft]);
    const { error: err } = await supabase.rpc("post_room_message", { p_event: eventId, p_body: body, p_kind: "text" });
    if (err) {
      setMessages((l) => (l ?? []).filter((x) => x.id !== draft.id));
      if (err.message.includes("SLOW_MODE")) {
        setText(body);
        setCooldownUntil(Date.now() + s.slow_mode * 1000);
      }
      setError(eventError(err.message, { slowMode: s.slow_mode }));
      return;
    }
    if (s.slow_mode > 0) setCooldownUntil(Date.now() + s.slow_mode * 1000);
  }

  async function hype(emoji: string) {
    tapFeedback();
    burst(emoji);
    // The room accepts one reaction every two seconds; extra taps just show for you
    if (Date.now() - lastHype.current < 2100) return;
    lastHype.current = Date.now();
    const { error: err } = await supabase.rpc("post_room_message", { p_event: eventId, p_body: emoji, p_kind: "hype" });
    if (err && !err.message.includes("SLOW_DOWN")) setError(eventError(err.message));
  }

  const shown = (messages ?? []).filter((m) => m.kind !== "hype");

  return (
    <section className={clsx("relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card", className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">The room</h2>
        {s.slow_mode > 0 && s.room_chat && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-muted">
            <Timer size={13} /> Slow mode · {s.slow_mode}s
          </span>
        )}
      </div>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-3 lg:h-[52vh] lg:flex-none"
        aria-live="polite"
      >
        {messages === null && <p className="py-10 text-center text-[14px] text-muted">Loading the room…</p>}
        {messages !== null && shown.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold">It&apos;s quiet in here</p>
            <p className="mt-1 text-[14px] text-muted">{s.room_chat ? "Say hello to everyone — or send some hype." : "Send some hype to get things going."}</p>
          </div>
        )}
        {shown.map((m) => (
          <RoomLine key={m.id} m={m} mine={m.user_id === userId} />
        ))}
      </div>

      {/* Hype rising from the bottom corner */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-28 h-0">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="dp-rise absolute bottom-0 text-[30px]"
            style={{ left: `${b.left}%`, ["--dx" as string]: `${b.dx}px` }}
          >
            {b.emoji}
          </span>
        ))}
      </div>

      {s.hype && live && (
        <div className="grid grid-cols-8 gap-1 border-t border-line px-2 py-2">
          {HYPE_REACTIONS.map((h) => (
            <button
              key={h}
              onClick={() => hype(h)}
              className="grid h-10 place-items-center rounded-xl text-[22px] transition hover:bg-cream active:scale-90"
              aria-label={`Send ${h}`}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mx-3 mb-1 animate-fade-up rounded-xl bg-chili-soft px-3 py-2 text-center text-[13px] font-medium text-chili">{error}</p>}

      {!live ? (
        <p className="border-t border-line px-4 py-3 text-center text-[13px] text-muted">The room is closed.</p>
      ) : s.room_chat ? (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            enterKeyHint="send"
            placeholder="Say something to everyone…"
            aria-label="Message the room"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-cream px-4 text-[16px] outline-none focus:border-brand"
          />
          {waitLeft > 0 ? (
            <span className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-cream px-3.5 text-[13px] font-semibold text-muted tabular-nums" aria-live="polite">
              <Timer size={15} /> {waitLeft}s
            </span>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95", text.trim() ? "bg-brand text-white" : "bg-line text-muted")}
              aria-label="Send"
            >
              <SendHorizontal size={18} />
            </button>
          )}
        </form>
      ) : (
        <p className="flex items-center justify-center gap-2 border-t border-line px-4 py-3 text-center text-[13px] text-muted">
          <MessageSquareOff size={15} className="shrink-0" /> Room chat is off tonight — say hi to people from the Wall.
        </p>
      )}
    </section>
  );
}

function RoomLine({ m, mine }: { m: RoomMessage; mine: boolean }) {
  if (m.kind === "announce") {
    return (
      <div className="my-2 animate-fade-up rounded-2xl bg-gradient-to-br from-brand to-[#8f6bff] px-4 py-3 text-white shadow-card">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white/80 uppercase">
          <Megaphone size={13} /> From Dashpad
        </p>
        <p className="mt-0.5 text-[15px] leading-snug font-medium break-words">{m.body}</p>
      </div>
    );
  }
  if (m.kind === "moment") {
    return (
      <div className="my-2 animate-fade-up rounded-2xl border border-gold/50 bg-gold-soft px-4 py-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#9a6a0c] uppercase">
          <Sparkles size={13} /> Moment
        </p>
        <p className="mt-0.5 text-[15px] leading-snug font-medium break-words text-ink">{m.body}</p>
      </div>
    );
  }
  return (
    <p className={clsx("rounded-2xl px-3 py-1.5 text-[14px] leading-snug break-words", mine ? "bg-brand-soft/70" : "", m.id < 0 && "opacity-60")}>
      <span className="mr-1.5 font-semibold" style={{ color: mine ? undefined : nameColor(m.user_id) }}>
        {mine ? "You" : m.name || "Someone"}
      </span>
      <span className="text-ink-soft">{m.body}</span>
    </p>
  );
}
