"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { SmilePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buzz } from "@/lib/games";

// The first row is the favourites; the rest sit below them
export const REACTIONS = [
  "😂", "🔥", "😈", "😮", "😍", "😤", "👏", "💀",
  "🙈", "🤣", "😭", "🤯", "🥳", "😎", "😏", "🙄",
  "😬", "🥰", "😘", "🫣", "🤭", "👀", "🥵", "💔",
  "🫶", "💯", "🙌", "🙏", "🎯", "🏆", "⚡", "🍿",
];

type Float = { id: number; e: string; mine: boolean; x: number; dx: number; size: number };

/**
 * Emoji reactions during a game. They go straight to the other phone (nothing
 * is saved) and float up both screens.
 */
export function useReactions(gameId: string | null, offline?: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [floats, setFloats] = useState<Float[]>([]);
  const ch = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sent = useRef<number[]>([]);
  const n = useRef(0);

  const add = useCallback((e: string, mine: boolean) => {
    if (!REACTIONS.includes(e)) return;
    const id = ++n.current;
    // Yours rise on the right, theirs on the left
    const x = mine ? 62 + Math.random() * 26 : 8 + Math.random() * 26;
    setFloats((f) => [...f.slice(-24), { id, e, mine, x, dx: Math.round((Math.random() - 0.5) * 90), size: 34 + Math.round(Math.random() * 14) }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 2500);
  }, []);

  useEffect(() => {
    if (!gameId || offline) return;
    const c = supabase.channel(`game-fx:${gameId}`, { config: { broadcast: { self: false } } });
    c.on("broadcast", { event: "react" }, ({ payload }) => {
      add(String((payload as { e?: string })?.e ?? ""), false);
      buzz(6);
    }).subscribe();
    ch.current = c;
    return () => {
      ch.current = null;
      supabase.removeChannel(c);
    };
  }, [gameId, offline, supabase, add]);

  const send = useCallback(
    (e: string) => {
      // At most 8 every 3 seconds
      const now = Date.now();
      sent.current = sent.current.filter((t) => now - t < 3000);
      if (sent.current.length >= 8) return;
      sent.current.push(now);
      add(e, true);
      buzz(8);
      ch.current?.send({ type: "broadcast", event: "react", payload: { e } }).catch(() => {});
    },
    [add],
  );

  return { floats, send, add };
}

/** The emoji floating up the screen */
export function ReactionLayer({ floats }: { floats: Float[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {floats.map((f) => (
        <span
          key={f.id}
          className="gm-react absolute bottom-[14%]"
          style={{ left: `${f.x}%`, fontSize: f.size, "--dx": `${f.dx}px` } as React.CSSProperties}
        >
          <span className="gm-wiggle block drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]">{f.e}</span>
        </span>
      ))}
    </div>
  );
}

/** The smiley button for the game's top bar, and the tray of emoji it opens */
const HINT_KEY = "dp_react_hint";

/** The first game someone plays: point at the reactions button for a few seconds */
export function useReactionHint(on: boolean) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!on) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    const show = setTimeout(() => setHint(true), 1500);
    const hide = setTimeout(() => setHint(false), 9000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [on]);
  return { hint, dismiss: () => setHint(false) };
}

export function ReactionHint({ onTry }: { onTry: () => void }) {
  return (
    <button
      type="button"
      onClick={onTry}
      className="absolute top-[calc(max(12px,env(safe-area-inset-top))+52px)] right-[100px] z-40 w-[210px] animate-pop rounded-2xl bg-white px-3.5 py-2.5 text-left text-[13px] leading-snug text-ink shadow-lift"
    >
      <span aria-hidden className="absolute -top-1.5 right-[22px] h-3 w-3 rotate-45 bg-white" />
      <b className="block text-[14px]">Send a reaction 😂🔥</b>
      Tap the smiley to make emoji float up both screens.
      <span className="mt-1 block text-[11px] font-bold text-brand">Try it</span>
    </button>
  );
}

export function ReactionButton({ open, onToggle, pulse }: { open: boolean; onToggle: () => void; pulse?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx("relative grid h-10 w-10 place-items-center rounded-full transition", open ? "bg-gold text-ink" : pulse ? "gm-pulse bg-gold text-ink shadow-[0_0_0_4px_rgba(242,179,61,0.35)]" : "bg-white/12")}
      aria-label={open ? "Close reactions" : "Send a reaction"}
      aria-expanded={open}
    >
      {open ? <X size={19} /> : <SmilePlus size={19} />}
    </button>
  );
}

export function ReactionTray({ onSend, onIdle }: { onSend: (e: string) => void; onIdle: () => void }) {
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(onIdle, 5000);
  }, [onIdle]);
  useEffect(() => {
    poke();
    return () => {
      if (idle.current) clearTimeout(idle.current);
    };
  }, [poke]);
  return (
    <div className="gm-burst absolute inset-x-3 top-[calc(max(12px,env(safe-area-inset-top))+48px)] z-40 grid grid-cols-8 justify-items-center gap-y-0.5 rounded-[24px] bg-[#140d33]/92 px-2 py-2 shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-md">
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => {
            onSend(e);
            poke();
          }}
          className="grid h-10 w-10 place-items-center rounded-full text-[25px] transition hover:bg-white/10 active:scale-125"
          aria-label={`Send ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
