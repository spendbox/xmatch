"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { nameColor } from "@/lib/eventSpace";
import { usePlaying } from "@/lib/playing";
import { useCall } from "@/components/calls/CallProvider";
import type { ChatMessage, MatchSummary } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Photo } from "@/components/ui/Photo";
import { Sheet } from "@/components/ui/Sheet";
import { snippet } from "@/components/chat/MessageList";
import { usePaidChatPeople } from "@/components/masquerade/usePaidChatPeople";
import type { MaskedChat } from "@/components/matches/MaskedChats";
import { CHATS_EVENT, refreshMenuBadges } from "./useMenuBadges";

/** A chat with a new message from them */
export type Pop = {
  key: string;
  kind: "match" | "masked";
  /** The match or masked chat id */
  id: string;
  href: string;
  name: string;
  photo?: string | null;
  /** Their id (for their photo or mask) */
  personId?: string;
  /** Masked chats: their alias picks the mask's colour */
  alias?: string;
  text: string;
  count: number;
};

/** A bubble stays a minute after the last message, then goes */
const BUBBLE_MS = 60_000;
const BANNER_MS = 5_000;

/**
 * New messages follow you round Dashpad: a banner slides in at the top (only a quiet bubble count
 * while a game is open), then a bubble waits at the edge for a minute. Tap it to read and reply
 * without leaving the page. No sound.
 */
export function MessagePops({ userId, demo }: { userId: string; demo?: { banner?: Pop; bubbles?: Pop[]; open?: Pop; messages?: ChatMessage[] } }) {
  const supabase = useMemo(() => createClient(), []);
  const path = usePathname();
  const router = useRouter();
  // Quiet (a count on the bubble, no banner) while a game is open or you're on a call
  const playing = usePlaying() || !!useCall().call;
  const paid = usePaidChatPeople(!!demo);
  const [banner, setBanner] = useState<Pop | null>(demo?.banner ?? null);
  const [bubbles, setBubbles] = useState<Pop[]>(demo?.bubbles ?? []);
  const [open, setOpen] = useState<Pop | null>(demo?.open ?? null);
  // When each chat's latest message was, the last time we looked. Nothing from before this page
  // opened pops, so there's nothing to load until a chat actually changes.
  const seen = useRef<Map<string, number>>(new Map());
  const since = useRef(Date.now());
  const until = useRef<Map<string, number>>(new Map());
  const here = useRef({ path, open: null as string | null, playing });
  here.current = { path, open: open?.key ?? null, playing };

  const check = useCallback(async () => {
    const [m, s] = await Promise.all([supabase.rpc("get_matches"), supabase.rpc("my_masked_chats")]);
    if (m.error && s.error) return;
    const fresh: Pop[] = [];
    const next = new Map<string, number>();
    for (const c of (Array.isArray(m.data) ? m.data : []) as MatchSummary[]) {
      const key = `m:${c.id}`;
      const at = new Date(c.last_message_at).getTime();
      next.set(key, at);
      if (at > (seen.current.get(key) ?? since.current) && c.last_sender === c.other_id && c.last_message) {
        fresh.push({ key, kind: "match", id: c.id, href: `/matches/${c.id}`, name: c.display_name, photo: c.photos?.[0], personId: c.other_id, text: c.last_message.replace(/^💬 /, ""), count: 1 });
      }
    }
    for (const c of (Array.isArray(s.data) ? s.data : []) as MaskedChat[]) {
      const key = `s:${c.id}`;
      const at = new Date(c.last_at).getTime();
      next.set(key, at);
      if (at > (seen.current.get(key) ?? since.current) && c.last_mine === false && c.last_message && !(c.pact && !c.pact_seen)) {
        fresh.push({ key, kind: "masked", id: c.id, href: `/masquerade/${c.id}`, name: c.alias, alias: c.alias, text: c.last_message, count: 1 });
      }
    }
    seen.current = next;
    const { path: now, open: reading, playing: game } = here.current;
    const shown = fresh.filter((p) => p.href !== now && p.key !== reading);
    if (!shown.length) return;
    const stamp = Date.now() + BUBBLE_MS;
    shown.forEach((p) => until.current.set(p.key, stamp));
    // Newest first; a chat that already has a bubble counts one more
    setBubbles((list) => [
      ...shown.map((p) => ({ ...p, count: (list.find((b) => b.key === p.key)?.count ?? 0) + 1 })),
      ...list.filter((b) => !shown.some((p) => p.key === b.key)),
    ]);
    // A banner, except while a game is open (then only the bubble's count)
    if (!game) setBanner(shown[0]);
  }, [supabase]);

  useEffect(() => {
    if (demo) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (t) clearTimeout(t);
      t = setTimeout(check, 500);
    };
    window.addEventListener(CHATS_EVENT, soon);
    return () => {
      window.removeEventListener(CHATS_EVENT, soon);
      if (t) clearTimeout(t);
    };
  }, [check, demo, userId]);

  // The banner goes after a few seconds; bubbles a minute after their last message
  useEffect(() => {
    if (!banner || demo) return;
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner, demo]);
  useEffect(() => {
    if (demo) return;
    const t = setInterval(() => {
      const now = Date.now();
      setBubbles((list) => (list.some((b) => (until.current.get(b.key) ?? 0) < now) ? list.filter((b) => (until.current.get(b.key) ?? 0) >= now) : list));
    }, 2_000);
    return () => clearInterval(t);
  }, [demo]);

  // Going into that chat clears its pop
  useEffect(() => {
    setBubbles((list) => list.filter((b) => b.href !== path));
    setBanner((b) => (b && b.href === path ? null : b));
  }, [path]);

  const named = (p: Pop): Pop => {
    // A masked chat started on Meet (or where you both waved): you already know who they are
    const known = p.kind === "masked" ? paid[p.id] : undefined;
    return known?.name ? { ...p, name: known.name, photo: known.photo, personId: known.id } : p;
  };
  const read = (p: Pop) => {
    setBanner(null);
    setBubbles((list) => list.filter((b) => b.key !== p.key));
    setOpen(p);
  };
  const go = (p: Pop) => {
    setBanner(null);
    setBubbles((list) => list.filter((b) => b.key !== p.key));
    router.push(p.href);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <>
      {banner && <Banner p={named(banner)} onOpen={() => go(banner)} onReply={() => read(banner)} onClose={() => setBanner(null)} />}
      {bubbles.length > 0 && <Bubbles list={bubbles.map(named)} quiet={playing} onTap={read} onClose={() => setBubbles([])} />}
      <MiniChat p={open ? named(open) : null} myId={userId} demo={demo?.messages} onClose={() => setOpen(null)} onOpenChat={go} />
    </>,
    document.body,
  );
}

/** Their photo, or their mask in a masked chat */
function Face({ p, size }: { p: Pop; size: number }) {
  if (p.kind === "match" || p.photo) {
    return p.photo ? (
      <span className="block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <Photo src={p.photo} id={p.personId} className="h-full w-full object-cover" />
      </span>
    ) : (
      <Avatar name={p.name} id={p.personId} size={size} />
    );
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: nameColor(p.alias ?? p.name) }}>
      <MaskIcon className="w-[58%] text-white" eyes={nameColor(p.alias ?? p.name)} />
    </span>
  );
}

/** Slides in at the top. Tap: open the chat. Reply: answer right here. Swipe it away, or it goes by itself. */
function Banner({ p, onOpen, onReply, onClose }: { p: Pop; onOpen: () => void; onReply: () => void; onClose: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[76] flex justify-center px-3 pt-[max(10px,env(safe-area-inset-top))]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md animate-fade-up touch-none items-center gap-3 rounded-[22px] bg-ink/95 p-2.5 pr-2 text-white shadow-lift backdrop-blur select-none [&_img]:pointer-events-none"
        onDragStart={(e) => e.preventDefault()}
        style={{ transform: `translate(${drag.x}px, ${Math.min(0, drag.y)}px)`, opacity: 1 - Math.min(0.8, (Math.abs(drag.x) + Math.max(0, -drag.y)) / 160) }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const d = { x: e.clientX - start.current.x, y: e.clientY - start.current.y };
          // Only a real swipe takes the pointer, so taps on its buttons still work
          if (Math.abs(d.x) + Math.abs(d.y) > 8) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDrag(d);
        }}
        onPointerUp={() => {
          const moved = Math.abs(drag.x) > 70 || drag.y < -40;
          start.current = null;
          setDrag({ x: 0, y: 0 });
          if (moved) onClose();
        }}
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Face p={p} size={42} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{p.name}</span>
            <span className="block truncate text-[13.5px] text-white/80">{p.text}</span>
          </span>
        </button>
        <button type="button" onClick={onReply} className="h-10 shrink-0 rounded-full bg-white/15 px-3.5 text-[13.5px] font-bold hover:bg-white/25">
          Reply
        </button>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="grid h-10 w-8 shrink-0 place-items-center text-white/70">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

/** Waits at the edge of the screen (drag it anywhere, or onto the ✕ to dismiss). Up to 3, then "+2". */
function Bubbles({ list, quiet, onTap, onClose }: { list: Pop[]; quiet: boolean; onTap: (p: Pop) => void; onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [side, setSide] = useState<"right" | "left">("right");
  const [dragging, setDragging] = useState(false);
  const [overBin, setOverBin] = useState(false);
  const grab = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [top, setTop] = useState(0.38);
  const shown = list.slice(0, 3);
  const more = list.length - shown.length;

  const end = (e: React.PointerEvent) => {
    const g = grab.current;
    grab.current = null;
    setDragging(false);
    if (!g) return;
    dragged.current = g.moved;
    if (overBin) {
      setOverBin(false);
      setPos(null);
      onClose();
      return;
    }
    if (g.moved) {
      // Snap to the nearest side, keeping the height
      setSide(e.clientX < window.innerWidth / 2 ? "left" : "right");
      setTop(Math.min(0.8, Math.max(0.1, e.clientY / window.innerHeight)));
    }
    setPos(null);
  };

  return (
    <>
      <div
        // Photos inside mustn't start the browser's own image drag (it cancels ours)
        className={clsx("fixed z-[75] flex touch-none flex-col gap-3 select-none [&_img]:pointer-events-none", !dragging && "transition-[top,left,right] duration-200")}
        onDragStart={(e) => e.preventDefault()}
        style={
          pos
            ? { left: pos.x, top: pos.y }
            : { top: `${top * 100}%`, [side]: "max(10px, env(safe-area-inset-right))" }
        }
        onPointerDown={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 8) return;
          if (!g.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          g.moved = true;
          setDragging(true);
          setPos({ x: e.clientX - g.dx, y: e.clientY - g.dy });
          setOverBin(Math.hypot(e.clientX - window.innerWidth / 2, e.clientY - (window.innerHeight - 70)) < 60);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          // Interrupted: stay where it was
          grab.current = null;
          setDragging(false);
          setOverBin(false);
          setPos(null);
        }}
      >
        {shown.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => !dragged.current && onTap(p)}
            aria-label={`${p.count} new from ${p.name}. Tap to read and reply`}
            className={clsx("relative animate-pop rounded-full shadow-lift ring-[3px] ring-surface", overBin && "scale-90 opacity-70")}
          >
            <Face p={p} size={58} />
            <span className={clsx("absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold ring-2 ring-surface", quiet ? "bg-ink text-white" : "bg-chili text-white")}>
              {p.count}
            </span>
          </button>
        ))}
        {more > 0 && (
          <span className="grid h-9 w-9 place-items-center self-center rounded-full bg-ink text-[12.5px] font-bold text-white shadow-lift">+{more}</span>
        )}
      </div>
      {dragging && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[74] flex justify-center pb-[max(28px,env(safe-area-inset-bottom))]">
          <span className={clsx("grid h-16 w-16 place-items-center rounded-full text-white shadow-lift transition", overBin ? "scale-110 bg-chili" : "bg-ink/80")}>
            <X size={26} />
          </span>
        </div>
      )}
    </>
  );
}

/** Read and reply over whatever you're doing: the last few messages and a box to answer */
function MiniChat({ p, myId, demo, onClose, onOpenChat }: { p: Pop | null; myId: string; demo?: ChatMessage[]; onClose: () => void; onOpenChat: (p: Pop) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(demo ?? []);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!p || demo) return;
    const q =
      p.kind === "match"
        ? supabase.from("messages").select("id, sender_id, kind, body, created_at, media_meta, deleted_at").eq("match_id", p.id)
        : supabase.from("masquerade_messages").select("id, sender_id, kind, body, created_at, media_meta").eq("session_id", p.id);
    const { data } = await q.order("id", { ascending: false }).limit(8);
    if (data) setMessages((data as ChatMessage[]).reverse());
    // Reading it here counts as reading it
    await (p.kind === "match" ? supabase.rpc("mark_chat_read", { p_match: p.id }) : supabase.rpc("mark_masked_read", { p_session: p.id }));
    refreshMenuBadges();
  }, [supabase, p, demo]);

  useEffect(() => {
    setText("");
    setError(null);
    if (!demo) setMessages([]);
    void load();
    if (!p || demo) return;
    window.addEventListener(CHATS_EVENT, load);
    return () => window.removeEventListener(CHATS_EVENT, load);
  }, [p, load, demo]);
  useEffect(() => {
    // (Newer browsers return a promise here, which an effect mustn't)
    void end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!p || !body) return;
    setText("");
    setError(null);
    const temp: ChatMessage = { id: -Date.now(), sender_id: myId, kind: "text", body, created_at: new Date().toISOString(), pending: true };
    setMessages((l) => [...l, temp]);
    if (demo) return;
    const { error: err } =
      p.kind === "match"
        ? await supabase.from("messages").insert({ match_id: p.id, sender_id: myId, kind: "text", body })
        : await supabase.from("masquerade_messages").insert({ session_id: p.id, sender_id: myId, body });
    if (err) {
      setMessages((l) => l.filter((m) => m.id !== temp.id));
      setText(body);
      setError("Message not sent. Check your connection and try again.");
      return;
    }
    notify(p.kind === "match" ? { kind: "message", matchId: p.id } : { kind: "masked_message", sessionId: p.id });
    void load();
  }

  return (
    <Sheet
      open={!!p}
      onClose={onClose}
      title={p?.name ?? ""}
      subtitle={p?.kind === "masked" ? "Masked chat" : undefined}
      icon={p ? <Face p={p} size={48} /> : undefined}
      layer="z-[80]"
      footer={
        <div className="space-y-2">
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Reply to {p?.name}</span>
              <input
                id="pop-reply"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Reply"
                autoComplete="off"
                maxLength={2000}
                className="h-12 w-full rounded-full border border-line-strong bg-cream px-4 text-[15px] outline-none focus:border-brand"
              />
            </label>
            <button type="submit" disabled={!text.trim()} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40">
              <ArrowUp size={21} />
            </button>
          </form>
          {p && (
            <button type="button" onClick={() => onOpenChat(p)} className="mx-auto block py-1 text-[13.5px] font-semibold text-brand">
              Open the full chat
            </button>
          )}
        </div>
      }
    >
      <div className="flex max-h-[42dvh] flex-col gap-2 overflow-y-auto">
        {messages.map((m) =>
          !m.sender_id ? (
            <p key={m.id} className="self-center rounded-full bg-cream px-3 py-1 text-center text-[12.5px] text-muted">{m.body.replace(/^💬 /, "")}</p>
          ) : (
            <p
              key={m.id}
              className={clsx(
                "max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] break-words",
                m.sender_id === myId ? "self-end rounded-br-md bg-brand text-white" : "self-start rounded-bl-md bg-cream text-ink",
                m.pending && "opacity-60",
              )}
            >
              {m.kind === "text" ? m.body : snippet(m)}
            </p>
          ),
        )}
        <div ref={end} />
      </div>
    </Sheet>
  );
}
