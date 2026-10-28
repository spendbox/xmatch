"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { applyMove, legalMoves, WIN, type AyoState } from "@/lib/boardgames/ayo";
import { MoveError } from "@/lib/boardgames/types";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";
import { useReportBusy } from "./boardBusy";

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

  useReportBusy(anim);
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
            background: PIT,
            boxShadow: flash.includes(i)
              ? `${CARVED}, 0 0 0 3px ${GOLD}, 0 0 22px 6px rgba(242,179,61,0.8)`
              : can
                ? `${CARVED}, 0 0 0 3px ${color(owner)}`
                : !anim && st.last?.end === i
                  ? `${CARVED}, 0 0 0 2px rgba(255,240,210,0.75)`
                  : CARVED,
          }}
        >
          <Seeds n={n} />
          <span className="absolute -bottom-1 rounded-full bg-[#1a0d06]/85 px-2 text-[12px] leading-[18px] font-extrabold text-[#f3e6cf] tabular-nums ring-1 ring-[#f3e6cf]/20">{n}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2 pb-4">
      <div className="flex items-center gap-2.5">
        <Player name="You" photo={names.mePhoto} color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {store[me]}–{store[them]}
        </div>
        <Player right name={names.them} photo={names.themPhoto} onClick={names.onThem} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>

      <div
        ref={board}
        className="relative mt-3 flex min-h-0 flex-1 flex-col rounded-[32px] p-2.5"
        style={{
          background: WOOD,
          boxShadow: "0 10px 0 #3d2009, 0 30px 60px -20px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,230,190,0.25), inset 0 -3px 6px rgba(0,0,0,0.35)",
        }}
      >
        <SeedDefs />
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-2.5">
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
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[85%] transition-[left,top] duration-150 ease-out"
            style={{ left: hand.x, top: hand.y }}
          >
            <svg viewBox="0 0 40 34" className="h-9 w-10 drop-shadow-[0_8px_8px_rgba(0,0,0,0.55)]">
              <ellipse cx="20" cy="17" rx="16" ry="13" fill="url(#ayo-seed)" />
              <ellipse cx="14" cy="11" rx="5.5" ry="3" fill="#fff" opacity="0.55" transform="rotate(-20 14 11)" />
            </svg>
            <span className="absolute -top-2 -right-3 grid h-5 min-w-5 place-items-center rounded-full bg-[#1a0d06] px-1 text-[11px] font-black text-[#f3e6cf] ring-1 ring-[#f3e6cf]/30">
              {hand.n}
            </span>
          </span>
        )}
      </div>

      <p className={clsx("mt-3 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (anim
            ? "Sowing…"
            : myTurn
              ? legal.length && legal.length < mineAll.filter((i) => st.pits[i] > 0).length
                ? "They have no seeds. Pick a hole that gives them some"
                : "Tap a glowing hole. If your last seed makes 2 or 3 on their side, you take them"
              : game.status === "active"
                ? `${names.them} is thinking…`
                : `First to ${WIN} seeds wins`)}
      </p>
    </div>
  );
}

/** One player's half of the board: a groove carved in the wood, with their name tag */
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
      className="flex min-h-0 flex-col rounded-[24px] p-2 transition-shadow"
      style={{
        background: "linear-gradient(180deg, rgba(40,18,6,0.38), rgba(40,18,6,0.22))",
        boxShadow: turn
          ? "inset 0 3px 8px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,230,190,0.2), 0 0 0 2px rgba(255,214,140,0.7), 0 0 18px rgba(255,200,110,0.35)"
          : "inset 0 3px 8px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,230,190,0.2)",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1 rounded-full bg-[#1a0d06]/70 py-1 pr-2.5 pl-1.5 ring-1 ring-[#f3e6cf]/15">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-[#1a0d06]" style={{ background: color }} />
          <span className="min-w-0 truncate text-[12px] font-extrabold text-[#f3e6cf]">{name}</span>
        </span>
        <span className="shrink-0 text-[11px] font-black text-[#f3e6cf]/80 tabular-nums">{captured} seeds</span>
      </div>
      <div className="relative grid min-h-0 flex-1 grid-rows-[repeat(6,minmax(0,1fr))] gap-1.5">{children}</div>
      <p className="mt-1 text-center text-[10px] font-bold tracking-wider text-[#f3e6cf]/60 uppercase">
        {arrow === "up" ? "Sows upward ↑" : "Sows downward ↓"}
      </p>
    </div>
  );
}

// Wood: warm browns with long grain (fine noise stretched along the board) and a soft sheen
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.22' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 0 0.03  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")";
const WOOD = `${GRAIN}, linear-gradient(90deg, rgba(255,220,170,0.08), rgba(0,0,0,0.12) 50%, rgba(255,220,170,0.08)), linear-gradient(180deg, #9b5f2c 0%, #84501f 40%, #7a4619 60%, #93592a 100%)`;
const PIT = "radial-gradient(circle at 50% 38%, #4a2a12 0%, #331a09 45%, #1f0f05 80%, #170b03 100%)";
const CARVED = "inset 0 6px 12px rgba(0,0,0,0.75), inset 0 -2px 3px rgba(255,220,170,0.12), 0 1.5px 0 rgba(255,230,190,0.35), 0 -1px 0 rgba(0,0,0,0.35)";

/** The colours of a seed (shared by every seed on the board) */
function SeedDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <radialGradient id="ayo-seed" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#e9e6d6" />
          <stop offset="0.35" stopColor="#b9b6a2" />
          <stop offset="0.75" stopColor="#7f7c6a" />
          <stop offset="1" stopColor="#4f4c40" />
        </radialGradient>
        <radialGradient id="ayo-seed-b" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ece4cf" />
          <stop offset="0.4" stopColor="#c2b392" />
          <stop offset="0.8" stopColor="#857356" />
          <stop offset="1" stopColor="#544631" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** A heap of seeds: glossy grey-green nuts, each a slightly different oval at its own angle (up to 14 drawn) */
function Seeds({ n }: { n: number }) {
  const shown = Math.min(n, 14);
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-[11%] h-[78%] w-[78%]" aria-hidden>
      {Array.from({ length: shown }, (_, k) => {
        const a = k * 2.399963;
        const r = shown === 1 ? 0 : 9 + 25 * Math.sqrt(k / shown);
        const x = 50 + Math.cos(a) * r;
        const y = 52 + Math.sin(a) * r;
        const rot = (k * 67) % 180;
        const rx = 11 + ((k * 7) % 3);
        const ry = 9 + ((k * 5) % 2);
        return (
          <g key={k} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <ellipse cx="1.5" cy="2.5" rx={rx} ry={ry} fill="rgba(0,0,0,0.45)" />
            <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={k % 4 === 3 ? "url(#ayo-seed-b)" : "url(#ayo-seed)"} />
            <ellipse cx={-rx * 0.35} cy={-ry * 0.4} rx={rx * 0.38} ry={ry * 0.22} fill="#fff" opacity="0.55" />
          </g>
        );
      })}
    </svg>
  );
}
