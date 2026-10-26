"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { chime } from "@/lib/chime";
import { buzz, sfx } from "@/lib/games";
import { GIFTS } from "@/lib/keys";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { InterestIcon } from "@/components/ui/icons";

type Msg = { id: number; sender_id: string | null; kind: string; body: string; created_at: string };

/** Live extras for a game (gifts flying in, a chat just opened), sent between the two phones */
export function useGameSignals(gameId: string | null, on: (event: "gift" | "chat", payload: Record<string, string>) => void) {
  const supabase = useMemo(() => createClient(), []);
  const ch = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handler = useRef(on);
  handler.current = on;
  useEffect(() => {
    if (!gameId) return;
    const c = supabase.channel(`game-social:${gameId}`, { config: { broadcast: { self: false } } });
    c.on("broadcast", { event: "gift" }, ({ payload }) => handler.current("gift", payload as Record<string, string>));
    c.on("broadcast", { event: "chat" }, ({ payload }) => handler.current("chat", payload as Record<string, string>));
    c.subscribe();
    ch.current = c;
    return () => {
      supabase.removeChannel(c);
      ch.current = null;
    };
  }, [gameId, supabase]);
  return useCallback((event: "gift" | "chat", payload: Record<string, string> = {}) => {
    void ch.current?.send({ type: "broadcast", event, payload });
  }, []);
}

/** Messages with the other player, live, for the chat inside a game */
export function useGameChat(matchId: string | null, myId: string, panelOpen: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(panelOpen);
  openRef.current = panelOpen;

  useEffect(() => {
    if (panelOpen) setUnread(0);
  }, [panelOpen]);

  useEffect(() => {
    if (!matchId) return;
    let live = true;
    void supabase
      .from("messages")
      .select("id, sender_id, kind, body, created_at")
      .eq("match_id", matchId)
      .order("id", { ascending: false })
      .limit(40)
      .then(({ data }) => live && data && setMessages((data as Msg[]).reverse()));
    const c = supabase
      .channel(`game-chat:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (p) => {
        const m = p.new as Msg;
        setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
        if (m.sender_id && m.sender_id !== myId) {
          chime();
          buzz([15, 40, 15]);
          if (!openRef.current) setUnread((n) => n + 1);
        }
      })
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(c);
    };
  }, [matchId, myId, supabase]);

  const send = useCallback(
    async (text: string) => {
      if (!matchId || !text.trim()) return null;
      const { data, error } = await supabase
        .from("messages")
        .insert({ match_id: matchId, sender_id: myId, kind: "text", body: text.trim().slice(0, 1000) })
        .select("id, sender_id, kind, body, created_at")
        .single();
      if (error) return "Couldn't send. Try again.";
      sfx("tap");
      setMessages((l) => (l.some((x) => x.id === (data as Msg).id) ? l : [...l, data as Msg]));
      notify({ kind: "message", matchId });
      return null;
    },
    [matchId, myId, supabase],
  );
  return { messages, unread, send };
}

const FAB_KEY = "dp_game_chat_fab";

/** The floating chat button: drag it anywhere; tap to open the chat */
export function ChatFab({ unread, onOpen, locked }: { unread: number; onOpen: () => void; locked?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; id: number } | null>(null);
  const el = useRef<HTMLButtonElement>(null);

  // Start bottom right, above the dice and cards (or where you last left it)
  useEffect(() => {
    const parent = el.current?.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    let saved: { x: number; y: number } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(FAB_KEY) ?? "null");
    } catch {}
    setPos(saved ? clampPos(saved.x * r.width, saved.y * r.height, r) : { x: r.width - 70, y: r.height - 190 });
  }, []);

  function clampPos(x: number, y: number, r: DOMRect) {
    return { x: Math.max(8, Math.min(r.width - 64, x)), y: Math.max(70, Math.min(r.height - 72, y)) };
  }

  return (
    <button
      ref={el}
      type="button"
      aria-label={unread ? `Chat, ${unread} new` : "Chat"}
      className={clsx(
        "absolute z-40 grid h-14 w-14 touch-none place-items-center rounded-full text-white shadow-[0_10px_24px_-6px_rgba(0,0,0,0.6)] transition-transform active:scale-95",
        unread ? "bg-chili" : "bg-brand",
        !pos && "invisible",
      )}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => {
        if (!pos) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const parent = el.current?.parentElement;
        if (!d || !parent || !pos) return;
        const next = clampPos(e.clientX - d.dx, e.clientY - d.dy, parent.getBoundingClientRect());
        if (Math.abs(next.x - pos.x) + Math.abs(next.y - pos.y) > 2) d.moved = true;
        setPos(next);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        const parent = el.current?.parentElement;
        if (d?.moved && parent && pos) {
          const r = parent.getBoundingClientRect();
          try {
            localStorage.setItem(FAB_KEY, JSON.stringify({ x: pos.x / r.width, y: pos.y / r.height }));
          } catch {}
          return;
        }
        onOpen();
      }}
    >
      <MessageCircle size={24} fill={locked ? "none" : "currentColor"} fillOpacity={0.25} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-[12px] font-extrabold text-chili">{unread}</span>
      )}
    </button>
  );
}

/** Chat with the other player without leaving the game */
export function ChatPanel({
  open,
  onClose,
  them,
  matchId,
  myId,
  messages,
  onSend,
  cost,
  balance,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  them: { name: string; photo?: string | null };
  matchId: string | null;
  myId: string;
  messages: Msg[];
  onSend: (text: string) => Promise<string | null>;
  /** Keys to start the chat (only before there is one) */
  cost: number;
  balance: number | null;
  onStart: () => Promise<string | null>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length, open]);

  async function start() {
    setBusy(true);
    setErr(null);
    const e = await onStart();
    setBusy(false);
    if (e) setErr(e);
  }
  async function send() {
    const t = text;
    if (!t.trim()) return;
    setText("");
    const e = await onSend(t);
    if (e) {
      setErr(e);
      setText(t);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={them.name} subtitle={matchId ? "Your chat is saved in Chats" : undefined} layer="z-[70]" icon={<Avatar src={them.photo ?? undefined} name={them.name} size={40} />}>
      {!matchId ? (
        <div className="pb-2 text-center">
          <p className="text-[15px] text-ink-soft">
            Start a chat with {them.name.split(" ")[0]}. It&apos;s saved in Chats for you both, with this game in it.
          </p>
          <p className="mt-2 text-[13px] text-muted">
            {cost > 0 ? `If they don't reply within 48 hours, you get your Keys back.` : "Free to start."}
          </p>
          {err && <p className="mt-3 text-[13.5px] font-semibold text-chili">{err}</p>}
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || (balance !== null && balance < cost)}
            className="mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[16px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Starting…" : cost > 0 ? (
              <>
                Start chat · <KeyCoin size={20} /> {cost}
              </>
            ) : (
              "Start chat"
            )}
          </button>
          {balance !== null && balance < cost && <p className="mt-2 text-[13px] text-muted">You have {balance} Keys.</p>}
        </div>
      ) : (
        <div className="flex h-[52dvh] flex-col">
          <div ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
            {messages.length === 0 && <p className="pt-8 text-center text-[14px] text-muted">Say hi 👋</p>}
            {messages.map((m) => {
              const mine = m.sender_id === myId;
              if (m.kind === "game")
                return (
                  <p key={m.id} className="mx-auto w-fit rounded-full bg-cream px-3 py-1 text-center text-[12px] font-semibold text-muted">
                    🎮 You played {m.body}
                  </p>
                );
              if (m.kind === "gift") {
                const g = GIFTS.find((x) => x.id === m.body);
                return (
                  <div key={m.id} className={clsx("flex items-center gap-2", mine ? "justify-end" : "justify-start")}>
                    <span className="flex items-center gap-1.5 rounded-2xl bg-gold-soft px-3 py-1.5 text-[13px] font-semibold text-[#8a5a00]">
                      <GiftArt id={m.body} size={26} /> {mine ? "You sent" : "Sent you"} {g?.name ?? "a gift"}
                    </span>
                  </div>
                );
              }
              return (
                <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                  <span className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] break-words", mine ? "bg-brand text-white" : "bg-cream text-ink")}>
                    {m.kind === "text" ? m.body : m.kind === "audio" ? "Voice note" : m.kind === "image" ? "📷 Photo" : m.kind === "video" ? "🎬 Video" : m.body}
                  </span>
                </div>
              );
            })}
          </div>
          {err && <p className="pb-1 text-center text-[13px] font-semibold text-chili">{err}</p>}
          <form
            className="flex items-center gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              id="game-chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${them.name.split(" ")[0]}`}
              maxLength={1000}
              className="h-12 min-w-0 flex-1 rounded-full border border-line bg-cream px-4 text-[15px] outline-none focus:border-brand"
            />
            <button type="submit" aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-50" disabled={!text.trim()}>
              <Send size={19} />
            </button>
          </form>
        </div>
      )}
    </Sheet>
  );
}

export type PlayPerson = {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  photos: string[] | null;
  bio: string | null;
  interests: string[] | null;
  place: string | null;
  online: boolean;
  me_photo: string | null;
  match_id: string | null;
  cost: number;
  balance: number;
};

/** Who you're playing: their profile, on top of the game */
export function PersonSheet({ open, onClose, person, onMessage }: { open: boolean; onClose: () => void; person: PlayPerson | null; onMessage: () => void }) {
  const [i, setI] = useState(0);
  if (!person) return null;
  const photos = person.photos ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={`${person.name}${person.age ? `, ${person.age}` : ""}`} subtitle={[person.place, person.online ? "Online now" : null].filter(Boolean).join(" · ") || undefined} layer="z-[70]">
      {photos.length > 0 && (
        <button type="button" onClick={() => setI((n) => (n + 1) % photos.length)} className="relative block aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-cream" aria-label="Next photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[i % photos.length]} alt="" className="h-full w-full object-cover" />
          {photos.length > 1 && (
            <span className="absolute inset-x-3 top-2.5 flex gap-1">
              {photos.map((_, k) => (
                <span key={k} className={clsx("h-1 flex-1 rounded-full", k === i % photos.length ? "bg-white" : "bg-white/45")} />
              ))}
            </span>
          )}
        </button>
      )}
      {person.bio && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{person.bio}</p>}
      {(person.interests?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {person.interests!.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink">
              <InterestIcon name={t} size={13} /> {t}
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={onMessage} className="mt-5 mb-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[16px] font-bold text-white">
        <MessageCircle size={19} /> {person.match_id ? "Open chat" : person.cost > 0 ? `Message · ${person.cost} Keys` : "Message"}
      </button>
    </Sheet>
  );
}
