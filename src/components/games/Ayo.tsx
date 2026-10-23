"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { applyMove, legalMoves, WIN, type AyoState } from "@/lib/boardgames/ayo";
import { MoveError } from "@/lib/boardgames/types";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ayo, standing up: the board fills the screen, your pits run down the right (in your colour),
 * theirs down the left (in theirs), and seeds go round anticlockwise: up your side, down theirs.
 * Every move is played out seed by seed, with a seed flying from pit to pit.
 */
export function Ayo({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as AyoState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, started } = useMove(game, act);

  // What the board shows (it runs a little behind the game while a move plays out)
  const [pits, setPits] = useState<number[]>(st.pits);
  const [store, setStore] = useState(st.store);
  const [anim, setAnim] = useState(false);
  const [landing, setLanding] = useState<number | null>(null);
  const [flash, setFlash] = useState<number[]>([]);
  const [hand, setHand] = useState<{ x: number; y: number; n: number; on: boolean } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const pitEls = useRef<(HTMLButtonElement | null)[]>([]);
  const seen = useRef(st.moves);
  const played = useRef<number | null>(null);
  const run = useRef(0);
  const shownPits = useRef(st.pits);
  shownPits.current = pits;

  const myTurn = game.status === "active" && started && st.turn === me && !anim;
  const legal = myTurn ? legalMoves(st, me) : [];
  const mineAll = me === "a" ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
  // Top to bottom: your pits count down the right (you sow upwards), theirs count up the left
  const right = [...mineAll].reverse();
  const left = me === "a" ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];

  const centre = (i: number) => {
    const b = board.current?.getBoundingClientRect();
    const r = pitEls.current[i]?.getBoundingClientRect();
    if (!b || !r) return { x: 0, y: 0 };
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  };

  /** Play a move out: pick up the seeds, drop one in each pit along the way, then take any captures */
  async function playOut(start: number[], from: number, end: { pits: number[]; captured: number[]; store: AyoState["store"] }) {
    const id = ++run.current;
    setAnim(true);
    const p = [...start];
    let seeds = p[from];
    p[from] = 0;
    setPits([...p]);
    const step = Math.max(110, 260 - seeds * 10);
    setHand({ ...centre(from), n: seeds, on: true });
    sfx("tap");
    await wait(160);
    let i = from;
    while (seeds > 0) {
      if (run.current !== id) return;
      i = (i + 1) % 12;
      if (i === from) continue;
      setHand({ ...centre(i), n: seeds, on: true });
      await wait(step);
      if (run.current !== id) return;
      p[i] += 1;
      seeds -= 1;
      setPits([...p]);
      setLanding(i);
      buzz(4);
      setHand((h) => (h ? { ...h, n: seeds } : h));
    }
    setHand(null);
    setLanding(null);
    if (end.captured.length) {
      setFlash(end.captured);
      sfx("match");
      buzz([15, 30, 15]);
      await wait(650);
      if (run.current !== id) return;
      setFlash([]);
    }
    setPits(end.pits);
    setStore(end.store);
    setAnim(false);
  }

  // A move arrived: play it out (yours already started when you tapped)
  useEffect(() => {
    if (st.moves === seen.current) return;
    const prev = seen.current;
    seen.current = st.moves;
    const last = st.last;
    if (played.current === st.moves) {
      played.current = null;
      if (!anim) {
        setPits(st.pits);
        setStore(st.store);
      }
      return;
    }
    if (!last || st.moves !== prev + 1) {
      run.current++;
      setAnim(false);
      setHand(null);
      setPits(st.pits);
      setStore(st.store);
      return;
    }
    void playOut(shownPits.current, last.pit, { pits: st.pits, captured: last.captured, store: st.store });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.moves]);

  // The game ended by itself (nobody could move): show the final count
  useEffect(() => {
    if (!anim) setStore(st.store);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.store.a, st.store.b]);

  async function tap(i: number) {
    if (!legal.includes(i) || busy) return;
    // Start sowing straight away; the server checks the same rules
    try {
      const r = applyMove(st, me, i);
      played.current = st.moves + 1;
      void playOut(st.pits, i, { pits: r.state.pits, captured: r.state.last?.captured ?? [], store: r.state.store });
    } catch (e) {
      if (!(e instanceof MoveError)) throw e;
    }
    const ok = await send(i);
    if (!ok) {
      played.current = null;
      run.current++;
      setAnim(false);
      setHand(null);
      setPits(st.pits);
      setStore(st.store);
    }
  }

  const sub = (s: "a" | "b") => (st.turn === s && game.status === "active" ? (s === me ? "Your turn" : "Their turn") : `${store[s]} seeds`);

  const pitView = (i: number) => {
    const n = pits[i];
    const can = legal.includes(i);
    const owner = i < 6 ? "a" : "b";
    return (
      <div key={i} className="grid min-h-0 place-items-center">
        <button
          ref={(el) => {
            pitEls.current[i] = el;
          }}
          type="button"
          disabled={!can || busy}
          onClick={() => tap(i)}
          aria-label={`Pit with ${n} ${n === 1 ? "seed" : "seeds"}${can ? ". Tap to sow" : ""}`}
          className={clsx(
            "relative grid aspect-square h-full max-h-full w-auto max-w-full place-items-center rounded-full transition-transform duration-150",
            can && !busy && "gm-pulse active:scale-95",
            landing === i && "scale-110",
          )}
          style={{
            background: "radial-gradient(circle at 50% 35%, #4a2a10 0%, #2b1606 75%)",
            boxShadow: flash.includes(i)
              ? `inset 0 4px 10px rgba(0,0,0,0.6), 0 0 0 3px ${GOLD}, 0 0 22px 6px rgba(242,179,61,0.8)`
              : can
                ? `inset 0 4px 10px rgba(0,0,0,0.6), 0 0 0 3px ${color(owner)}`
                : !anim && st.last?.end === i
                  ? "inset 0 4px 10px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.7)"
                  : "inset 0 4px 10px rgba(0,0,0,0.6)",
          }}
        >
          <Seeds n={n} />
          <span className="absolute -bottom-1 rounded-full bg-black/60 px-2 text-[12px] leading-[18px] font-extrabold tabular-nums">{n}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2 pb-4">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {store[me]}–{store[them]}
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>

      <div
        ref={board}
        className="relative mt-3 flex min-h-0 flex-1 flex-col rounded-[32px] p-2.5"
        style={{ background: "linear-gradient(90deg,#8a5220,#b9762f 50%,#8a5220)", boxShadow: "0 10px 0 #5a3412, 0 30px 60px -20px rgba(194,122,50,0.7)" }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5">
          <Side name={names.them} color={color(them)} captured={store[them]} turn={st.turn === them && game.status === "active"} arrow="down">
            {left.map(pitView)}
          </Side>
          <Side name="You" color={color(me)} captured={store[me]} turn={st.turn === me && game.status === "active"} arrow="up">
            {right.map(pitView)}
          </Side>
        </div>

        {/* The seeds in hand, flying from pit to pit */}
        {hand && (
          <span
            aria-hidden
            className="pointer-events-none absolute z-20 grid h-9 w-9 -translate-x-1/2 -translate-y-[85%] place-items-center rounded-full text-[12px] font-black text-ink transition-[left,top] duration-150 ease-out"
            style={{
              left: hand.x,
              top: hand.y,
              background: "radial-gradient(circle at 35% 30%, #fffaf0, #d8cbb2)",
              boxShadow: "0 6px 14px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.6)",
            }}
          >
            {hand.n}
          </span>
        )}
      </div>

      <p className={clsx("mt-3 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (anim
            ? "Sowing…"
            : myTurn
              ? legal.length && legal.length < mineAll.filter((i) => st.pits[i] > 0).length
                ? "They have no seeds. Pick a pit that gives them some"
                : "Tap one of your glowing pits to sow · capture 2s and 3s"
              : game.status === "active"
                ? `${names.them} is thinking…`
                : `First to ${WIN} seeds wins`)}
      </p>
    </div>
  );
}

/** One player's half of the board: tinted in their colour, with their name and captures */
function Side({
  name,
  color,
  captured,
  turn,
  arrow,
  children,
}: {
  name: string;
  color: string;
  captured: number;
  turn: boolean;
  arrow: "up" | "down";
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-0 flex-col rounded-[24px] p-2 transition"
      style={{ background: `${color}2e`, boxShadow: turn ? `inset 0 0 0 2.5px ${color}` : `inset 0 0 0 1.5px ${color}55` }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1 rounded-full px-2.5 py-1" style={{ background: color }}>
        <span className="min-w-0 truncate text-[12px] font-extrabold text-ink">{name}</span>
        <span className="shrink-0 text-[11px] font-black text-ink/80 tabular-nums">{captured} 🫘</span>
      </div>
      <div className="relative grid min-h-0 flex-1 grid-rows-6 gap-1.5">{children}</div>
      <p className="mt-1 text-center text-[10px] font-bold tracking-wider text-white/60 uppercase">
        {arrow === "up" ? "Sows upward ↑" : "Sows downward ↓"}
      </p>
    </div>
  );
}

/** A little heap of seeds (up to 12 drawn, the number shows the rest) */
function Seeds({ n }: { n: number }) {
  const shown = Math.min(n, 12);
  return (
    <span className="relative block h-[70%] w-[70%]" aria-hidden>
      {Array.from({ length: shown }, (_, k) => {
        const a = (k * 137.5 * Math.PI) / 180;
        const rad = 0.16 + 0.22 * Math.sqrt(k / Math.max(1, shown));
        return (
          <span
            key={k}
            className="absolute h-[22%] w-[22%] rounded-full"
            style={{
              left: `${50 + Math.cos(a) * rad * 100 - 11}%`,
              top: `${50 + Math.sin(a) * rad * 100 - 11}%`,
              background: "radial-gradient(circle at 35% 30%, #f6efe2, #b9ab92)",
              boxShadow: "0 1px 1px rgba(0,0,0,0.45)",
            }}
          />
        );
      })}
    </span>
  );
}
