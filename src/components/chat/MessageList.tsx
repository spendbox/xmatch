"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Ban, Clock3, Copy, Timer, CornerUpLeft, MessageCircleQuestion, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Reply, Trash2, Video,
} from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { formatDuration } from "@/lib/chatMedia";
import { giftById } from "@/lib/keys";
import { GiftArt } from "@/components/keys/GiftArt";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner, tapFeedback } from "@/components/ui/Button";
import { AudioPlayer } from "./AudioPlayer";
import { MediaViewer, type ViewerItem } from "./MediaViewer";
import { GameCard } from "@/components/games/GameCard";
import { useSignedUrl } from "./useSignedUrl";

type Props = {
  messages: ChatMessage[];
  myId: string;
  /** Display name for a sender id (e.g. "Ada", or an alias in masked chats) */
  nameOf: (senderId: string | null) => string;
  onReply?: (m: ChatMessage) => void;
  onDelete?: (m: ChatMessage) => void;
  showDates?: boolean;
  footer?: React.ReactNode;
  /** "Play again" on a game result card */
  onGameAgain?: (kind: string) => void;
};

/** One-line description of a message, used in reply quotes. */
export function snippet(m: ChatMessage | undefined) {
  if (!m) return "Original message";
  if (m.deleted_at) return "Message deleted";
  switch (m.kind) {
    case "image":
      return "📷 Photo" + (m.body ? ` · ${m.body}` : "");
    case "video":
      return "🎬 Video" + (m.body ? ` · ${m.body}` : "");
    case "audio":
      return `🎤 Voice note · ${formatDuration(m.media_meta?.duration)}`;
    case "call":
      return "📞 Call";
    case "gift":
      return `Gift · ${giftById(m.media_meta?.gift ?? m.body)?.name ?? "Surprise"}`;
    case "game":
      return `🎮 ${m.body}`;
    default:
      return m.body.replace(/^💬 /, "");
  }
}

export function MessageList({ messages, myId, nameOf, onReply, onDelete, showDates, footer, onGameAgain }: Props) {
  // Times use the phone's own clock and time zone, so wait until we're on the phone
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const end = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const byId = useRef(new Map<number, ChatMessage>());
  byId.current = new Map(messages.map((m) => [m.id, m]));

  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Open at the newest message straight away; glide down for new ones after that
  const scrollerOf = () => {
    const el = root.current;
    return (el?.closest("[data-chat-scroll]") as HTMLElement | null) ?? el?.parentElement ?? null;
  };
  useEffect(() => {
    const sc = scrollerOf();
    if (!sc) {
      end.current?.scrollIntoView({ block: "end" });
      return;
    }
    if (!first.current) {
      sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
      return;
    }
    first.current = false;
    // On opening, hold the view at the bottom for a moment while dates, photos and cards settle,
    // unless they start scrolling themselves
    let raf = 0;
    let stop = false;
    const until = performance.now() + 1500;
    const hold = () => {
      if (stop) return;
      sc.scrollTop = sc.scrollHeight;
      if (performance.now() < until) raf = requestAnimationFrame(hold);
    };
    const quit = () => (stop = true);
    sc.addEventListener("wheel", quit, { passive: true });
    sc.addEventListener("touchstart", quit, { passive: true });
    hold();
    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("wheel", quit);
      sc.removeEventListener("touchstart", quit);
    };
  }, [messages.length]);

  // Stay at the bottom while photos, voice notes and dates load in (unless they've scrolled up to read)
  useEffect(() => {
    const scroller = scrollerOf();
    if (!scroller) return;
    let stuck = true;
    const onScroll = () => {
      stuck = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      if (stuck) scroller.scrollTop = scroller.scrollHeight;
    });
    // Watch everything in the chat area, not just the messages (cards above/below can grow too)
    Array.from(scroller.children).forEach((c) => ro.observe(c));
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const jumpTo = useCallback((id: number) => {
    const el = document.querySelector(`[data-msg="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  }, []);

  return (
    <div ref={root} className="flex flex-col gap-1 px-3 py-4 lg:px-8">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = mounted && showDates && (!prev || dayKey(prev.created_at) !== dayKey(m.created_at));
        const dateLine = newDay ? (
          <div key={`d-${m.id}`} className="my-3 flex justify-center">
            <span className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-muted shadow-card">{dayLabel(m.created_at)}</span>
          </div>
        ) : null;

        if (m.kind === "gift") {
          const g = giftById(m.media_meta?.gift ?? m.body);
          const mine = m.sender_id === myId;
          return (
            <div key={m.id}>
              {dateLine}
              <div className={clsx("my-2 flex", mine ? "justify-end" : "justify-start")} data-msg={m.id}>
                <div className={clsx("relative w-[200px] overflow-hidden rounded-[24px] p-4 text-center", mine ? "bg-gradient-to-br from-brand to-[#c2306b] text-white" : "border border-gold/40 bg-gradient-to-br from-gold-soft to-[#fff1f4]")}>
                  <span aria-hidden className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/20" />
                  <GiftArt id={g?.id ?? ""} size={76} className="relative mx-auto animate-pop drop-shadow-md" />
                  <p className={clsx("relative mt-2 text-[14px] font-semibold", !mine && "text-ink")}>
                    {mine ? `You sent a ${g?.name ?? "gift"}` : `${nameOf(m.sender_id)} sent you a ${g?.name ?? "gift"}`}
                  </p>
                  {mounted && <p className={clsx("relative mt-0.5 text-[11px]", mine ? "text-white/75" : "text-muted")}>{time(m.created_at)}</p>}
                </div>
              </div>
            </div>
          );
        }

        if (m.kind === "game") {
          return (
            <div key={m.id}>
              {dateLine}
              <GameCard m={m} myId={myId} nameOf={nameOf} onAgain={onGameAgain} onReply={onReply} />
            </div>
          );
        }

        if (m.kind === "system") {
          return (
            <div key={m.id} className="my-2 flex justify-center" data-msg={m.id}>
              <span className="inline-flex animate-pop items-center gap-1.5 rounded-full bg-mint-soft px-3.5 py-1.5 text-[12px] font-semibold text-mint">
                <Timer size={13} /> {m.body}
              </span>
            </div>
          );
        }

        if (m.kind === "icebreaker" || (!m.sender_id && m.kind !== "call")) {
          return (
            <div key={m.id}>
              {dateLine}
              <div className="my-2 flex justify-center animate-fade-up" data-msg={m.id}>
                <div className="max-w-[88%] rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3 text-center">
                  <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-[#9a6a0c] uppercase">
                    <MessageCircleQuestion size={13} /> Icebreaker
                  </p>
                  <p className="text-[15px] font-medium leading-snug text-ink">{m.body.replace(/^💬 /, "")}</p>
                </div>
              </div>
            </div>
          );
        }

        if (m.kind === "call") {
          return (
            <div key={m.id}>
              {dateLine}
              <CallRecord m={m} mine={m.sender_id === myId} showTime={mounted} />
            </div>
          );
        }

        const mine = m.sender_id === myId;
        const firstOfGroup = !prev || prev.sender_id !== m.sender_id || prev.kind === "call" || !!newDay;
        const lastOfGroup = !next || next.sender_id !== m.sender_id || next.kind === "call";
        return (
          <div key={m.id}>
            {dateLine}
            <SwipeRow
              mine={mine}
              disabled={!onReply || !!m.deleted_at || m.pending}
              onReply={() => onReply?.(m)}
              onLongPress={() => !m.pending && setMenu(m)}
            >
              <div className={clsx("flex flex-col", mine ? "items-end" : "items-start", firstOfGroup && "mt-2")} data-msg={m.id}>
                <Bubble
                  m={m}
                  mine={mine}
                  flash={flash === m.id}
                  quote={m.reply_to ? byId.current.get(m.reply_to) : undefined}
                  quoteName={(q) => (q.sender_id === myId ? "You" : nameOf(q.sender_id))}
                  onQuote={() => m.reply_to && jumpTo(m.reply_to)}
                  onOpen={setViewer}
                  tail={lastOfGroup}
                />
                {lastOfGroup && (
                  <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted">
                    {m.failed ? (
                      <span className="font-semibold text-chili">Not sent</span>
                    ) : m.pending ? (
                      <>
                        <Clock3 size={11} /> Sending…
                      </>
                    ) : mounted ? (
                      time(m.created_at)
                    ) : null}
                  </span>
                )}
              </div>
            </SwipeRow>
          </div>
        );
      })}
      {footer}
      <div ref={end} />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title="Message" subtitle={menu ? snippet(menu).slice(0, 80) : undefined}>
        <div className="space-y-1.5 pb-2">
          {onReply && (
            <MenuButton icon={<Reply size={19} />} label="Reply" onClick={() => { onReply(menu!); setMenu(null); }} />
          )}
          {menu && menu.body && menu.kind !== "audio" ? (
            <MenuButton
              icon={<Copy size={19} />}
              label="Copy text"
              onClick={() => {
                navigator.clipboard?.writeText(menu!.body.replace(/^💬 /, "")).catch(() => {});
                setMenu(null);
              }}
            />
          ) : null}
          {onDelete && menu?.sender_id === myId && !menu.deleted_at && (
            <MenuButton danger icon={<Trash2 size={19} />} label="Delete for everyone" onClick={() => { onDelete(menu!); setMenu(null); }} />
          )}
        </div>
      </Sheet>
      <MediaViewer item={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium transition active:scale-[0.98]",
        danger ? "text-chili hover:bg-chili-soft" : "hover:bg-cream",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Swipe a message to the right to reply. Press and hold for more options. */
function SwipeRow({
  children,
  mine,
  disabled,
  onReply,
  onLongPress,
}: {
  children: React.ReactNode;
  mine: boolean;
  disabled?: boolean;
  onReply: () => void;
  onLongPress: () => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> | null; locked: boolean } | null>(null);
  const swallowClick = useRef(false);

  function down(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swallowClick.current = false;
    const t = setTimeout(() => {
      tapFeedback();
      swallowClick.current = true;
      onLongPress();
      start.current = null;
    }, 480);
    start.current = { x: e.clientX, y: e.clientY, t, locked: false };
  }
  function move(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) {
      if (s.t) clearTimeout(s.t);
      s.t = null;
    }
    if (disabled) return;
    if (!s.locked && Math.abs(y) > Math.abs(x)) return; // scrolling, not swiping
    if (x > 6) {
      s.locked = true;
      swallowClick.current = true;
      setDx(Math.min(72, x * 0.8));
    }
  }
  function up() {
    const s = start.current;
    if (s?.t) clearTimeout(s.t);
    if (dx > 54) {
      tapFeedback();
      onReply();
    }
    setDx(0);
    start.current = null;
  }

  return (
    <div
      className="relative touch-pan-y select-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          e.preventDefault();
          e.stopPropagation();
          swallowClick.current = false;
        }
      }}
      onPointerLeave={() => dx === 0 && start.current?.t && clearTimeout(start.current.t)}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
    >
      <span
        className="pointer-events-none absolute top-1/2 left-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-brand-soft text-brand transition-opacity"
        style={{ opacity: Math.min(1, dx / 54) }}
        aria-hidden
      >
        <CornerUpLeft size={16} />
      </span>
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={clsx(dx === 0 && "transition-transform duration-200", mine ? "pl-10" : "pr-10")}
      >
        {children}
      </div>
    </div>
  );
}

function Bubble({
  m,
  mine,
  flash,
  quote,
  quoteName,
  onQuote,
  onOpen,
  tail,
}: {
  m: ChatMessage;
  mine: boolean;
  flash: boolean;
  quote?: ChatMessage;
  quoteName: (q: ChatMessage) => string;
  onQuote: () => void;
  onOpen: (v: ViewerItem) => void;
  tail: boolean;
}) {
  const media = m.kind === "image" || m.kind === "video";
  const shell = clsx(
    "max-w-[80%] overflow-hidden break-words transition-shadow duration-500 lg:max-w-[62%]",
    mine ? "bg-brand text-white" : "bg-surface text-ink shadow-card",
    tail ? (mine ? "rounded-[20px] rounded-br-md" : "rounded-[20px] rounded-bl-md") : "rounded-[20px]",
    flash && "ring-4 ring-gold/70",
    media && !m.body && !m.reply_to ? "p-1" : "",
  );

  if (m.deleted_at) {
    return (
      <p className={clsx("flex items-center gap-1.5 rounded-[20px] border border-dashed px-4 py-2.5 text-[14px] italic", mine ? "border-brand/30 text-brand/70" : "border-line-strong text-muted")}>
        <Ban size={14} /> This message was deleted
      </p>
    );
  }

  return (
    <div className={shell}>
      {m.reply_to ? (
        <button
          type="button"
          onClick={onQuote}
          className={clsx(
            "m-1 mb-0 block w-[calc(100%-0.5rem)] rounded-[14px] border-l-[3px] px-3 py-1.5 text-left",
            mine ? "border-white/80 bg-white/15" : "border-brand bg-brand-soft/70",
          )}
        >
          <span className={clsx("block text-[12px] font-semibold", mine ? "text-white" : "text-brand")}>{quote ? quoteName(quote) : "Reply"}</span>
          <span className={clsx("line-clamp-1 text-[13px]", mine ? "text-white/80" : "text-muted")}>{snippet(quote)}</span>
        </button>
      ) : null}

      {m.kind === "image" && <ImageContent m={m} onOpen={onOpen} />}
      {m.kind === "video" && <VideoContent m={m} onOpen={onOpen} />}
      {m.kind === "audio" && (
        <div className="px-3 py-2">
          <AudioPlayer path={m.media_path} localUrl={m.local_url} duration={m.media_meta?.duration} mine={mine} seed={Math.abs(m.id)} />
        </div>
      )}
      {(m.kind === "text" || !m.kind || (media && m.body)) && m.body ? (
        <p className={clsx("text-[15px] leading-snug whitespace-pre-wrap", media ? "px-3 pt-1.5 pb-2" : "px-4 py-2.5")}>{m.body}</p>
      ) : null}
    </div>
  );
}

function ImageContent({ m, onOpen }: { m: ChatMessage; onOpen: (v: ViewerItem) => void }) {
  const url = useSignedUrl(m.media_path, m.local_url);
  const w = m.media_meta?.width;
  const h = m.media_meta?.height;
  const ratio = w && h ? Math.min(Math.max(w / h, 0.6), 1.6) : 0.8;
  return (
    <button
      type="button"
      onClick={() => url && onOpen({ url, kind: "image" })}
      className="relative block w-[240px] max-w-full overflow-hidden rounded-[16px] bg-line"
      style={{ aspectRatio: ratio }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="Photo" className="h-full w-full object-cover" loading="lazy" />}
      {m.pending && (
        <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">
          <Spinner className="h-7 w-7" />
        </span>
      )}
    </button>
  );
}

function VideoContent({ m, onOpen }: { m: ChatMessage; onOpen: (v: ViewerItem) => void }) {
  const url = useSignedUrl(m.media_path, m.local_url);
  return (
    <button
      type="button"
      onClick={() => url && !m.pending && onOpen({ url, kind: "video" })}
      className="relative block aspect-[4/5] w-[240px] max-w-full overflow-hidden rounded-[16px] bg-ink"
    >
      {url && <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
          {m.pending ? <Spinner className="h-6 w-6" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}
        </span>
      </span>
      {m.media_meta?.duration ? (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
          {formatDuration(m.media_meta.duration)}
        </span>
      ) : null}
    </button>
  );
}

function CallRecord({ m, mine, showTime }: { m: ChatMessage; mine: boolean; showTime: boolean }) {
  const video = m.media_meta?.call === "video";
  const secs = m.media_meta?.seconds ?? 0;
  const missed = m.body === "missed" || m.body === "declined" || m.body === "cancelled";
  let label = `${video ? "Video" : "Voice"} call`;
  if (m.body === "ended" && secs) label += ` · ${formatDuration(secs)}`;
  else if (m.body === "declined") label = mine ? `${label} declined` : `Declined ${label.toLowerCase()}`;
  else if (missed) label = mine ? `${label} · No answer` : `Missed ${label.toLowerCase()}`;
  const Icon = missed && !mine ? PhoneMissed : video ? Video : mine ? PhoneOutgoing : m.body === "ended" ? PhoneIncoming : Phone;
  return (
    <div className="my-2 flex justify-center" data-msg={m.id}>
      <span
        className={clsx(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold shadow-card",
          missed && !mine ? "bg-chili-soft text-chili" : "bg-surface text-ink-soft",
        )}
      >
        <Icon size={15} /> {label}
        {showTime && <span className="font-normal text-muted">· {time(m.created_at)}</span>}
      </span>
    </div>
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dayKey(iso: string) {
  return new Date(iso).toDateString();
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
