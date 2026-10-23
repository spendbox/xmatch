"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Shuffle } from "lucide-react";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { SIZE, SWAPS, TURNS, adjacent, hasMove, swapWorks, type GemsState } from "@/lib/boardgames/gems";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";
import { Gem, GemDefs } from "./Gems";

type View = {
  board: string[];
  /** Changes whenever gems should animate in fresh */
  key: number;
  pop?: Set<number>;
  drop?: number[];
  /** Gems sliding in from a neighbour: [rows, cols] they came from */
  slide?: Record<number, [number, number]>;
  shake?: boolean;
};
type Float = { id: number; text: string; x: number; y: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;

/** Where two swapped gems came from, so they slide past each other */
function slideOf(a: number, b: number): Record<number, [number, number]> {
  const [ra, ca] = rc(a);
  const [rb, cb] = rc(b);
  return { [a]: [rb - ra, cb - ca], [b]: [ra - rb, ca - cb] };
}
const swapped = (board: string[], a: number, b: number) => {
  const t = [...board];
  [t[a], t[b]] = [t[b], t[a]];
  return t;
};

/** Gem Clash: match-3 on one shared board, taking turns */
export function GemClash({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as GemsState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, setNote, started } = useMove(game, act);

  const [view, setView] = useState<View>({ board: st.board, key: 0 });
  const [anim, setAnim] = useState(false);
  const [shown, setShown] = useState(st.points);
  const [sel, setSel] = useState<number | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const seen = useRef(st.moves);
  const keyRef = useRef(1);
  const run = useRef(0);
  const mine = useRef<string | null>(null);
  const boardRef = useRef(st.board);
  boardRef.current = st.board;
  const drag = useRef<{ i: number; x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const myTurn = game.status === "active" && started && st.turn === me;
  const canPlay = myTurn && !busy && !anim;
  const round = Math.min(TURNS, Math.min(st.done.a, st.done.b) + 1);
  const nextKey = () => keyRef.current++;

  function say(text: string) {
    const id = nextKey();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1300);
  }

  // Play every new move out: swap, pop, fall, cascade
  useEffect(() => {
    if (st.moves === seen.current) return;
    const prev = seen.current;
    seen.current = st.moves;
    const last = st.last;
    const id = ++run.current;
    setSel(null);
    setHint(null);
    if (!last || st.moves !== prev + 1 || !last.steps.length) {
      // Missed a move, or a shuffle: just show the board
      setView({ board: st.board, key: nextKey() });
      setShown(st.points);
      setAnim(false);
      if (last?.shuffled) say("No moves left · shuffled!");
      return;
    }
    const finalBoard = st.board;
    const finalPoints = st.points;
    (async () => {
      setAnim(true);
      const [a, b] = last.swap;
      const ownSwap = mine.current === `${a}-${b}`;
      mine.current = null;
      let pts = finalPoints[last.by] - last.gained;
      setShown({ ...finalPoints, [last.by]: pts });
      if (!ownSwap) {
        setView({ board: last.before, key: nextKey(), slide: slideOf(a, b) });
        await wait(240);
      }
      for (const [n, step] of last.steps.entries()) {
        if (run.current !== id) return;
        setView((v) => ({ ...v, pop: new Set(step.clear) }));
        sfx(n === 0 ? "match" : "word");
        buzz(n === 0 ? 12 : [8, 30, 8]);
        const cells = step.clear.map(rc);
        const x = ((cells.reduce((s, [, c]) => s + c, 0) / cells.length + 0.5) / SIZE) * 100;
        const y = ((cells.reduce((s, [r]) => s + r, 0) / cells.length + 0.5) / SIZE) * 100;
        const fid = nextKey();
        setFloats((f) => [...f, { id: fid, text: `+${step.points}`, x, y }]);
        setTimeout(() => setFloats((f) => f.filter((q) => q.id !== fid)), 1000);
        if (n >= 1) say(n >= 3 ? `Mega combo ×${n + 1}!` : `Combo ×${n + 1}!`);
        await wait(230);
        if (run.current !== id) return;
        pts += step.points;
        setShown((s) => ({ ...s, [last.by]: pts }));
        setView({ board: step.board, key: nextKey(), drop: step.drop });
        await wait(330);
      }
      if (run.current !== id) return;
      setView((v) => ({ board: finalBoard, key: v.key }));
      setShown(finalPoints);
      setAnim(false);
      if (last.shuffled) say("No moves left · shuffled!");
      else if (last.extra) say(last.by === me ? "Extra swap!" : "They got an extra swap");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.moves]);

  // Stuck for a while on your turn? Show a move
  useEffect(() => {
    setHint(null);
    if (!canPlay) return;
    const t = setTimeout(() => {
      const b = boardRef.current;
      for (let i = 0; i < b.length; i++) {
        for (const j of [i + 1, i + SIZE]) {
          if (j < b.length && (j !== i + 1 || i % SIZE < SIZE - 1) && swapWorks(b, i, j)) return setHint([i, j]);
        }
      }
    }, 9000);
    return () => clearTimeout(t);
  }, [canPlay, st.moves]);

  async function trySwap(a: number, b: number) {
    setSel(null);
    if (!canPlay || !adjacent(a, b)) return;
    const board = boardRef.current;
    if (!swapWorks(board, a, b)) {
      // Slide over and back
      setView({ board: swapped(board, a, b), key: nextKey(), slide: slideOf(a, b) });
      sfx("bad");
      buzz([10, 40, 10]);
      await wait(200);
      setView({ board, key: nextKey(), slide: slideOf(a, b), shake: true });
      setNote("No match there");
      return;
    }
    mine.current = `${a}-${b}`;
    setView({ board: swapped(board, a, b), key: nextKey(), slide: slideOf(a, b) });
    const ok = await send({ type: "swap", a, b });
    if (!ok) {
      mine.current = null;
      setView({ board: boardRef.current, key: nextKey() });
    }
  }

  function down(e: React.PointerEvent, i: number) {
    if (!canPlay) return;
    drag.current = { i, x: e.clientX, y: e.clientY };
    gridRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !gridRef.current) return;
    const cell = gridRef.current.clientWidth / SIZE;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.35) return;
    drag.current = null;
    const [r, c] = rc(d.i);
    const to = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < SIZE - 1 ? d.i + 1 : -1) : c > 0 ? d.i - 1 : -1) : dy > 0 ? (r < SIZE - 1 ? d.i + SIZE : -1) : r > 0 ? d.i - SIZE : -1;
    if (to >= 0) void trySwap(d.i, to);
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // A tap: pick a gem, then tap a neighbour to swap
    if (sel !== null && adjacent(sel, d.i)) void trySwap(sel, d.i);
    else setSel(sel === d.i ? null : d.i);
  }

  const stuck = myTurn && !anim && !hasMove(st.board);
  const sub = (s: "a" | "b") =>
    st.turn === s && game.status === "active" ? (s === me ? "Your turn" : "Their turn") : `${st.done[s]}/${TURNS} turns`;

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2 pb-4">
      <GemDefs />
      <div className="flex items-center gap-2">
        <Player name="You" color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="text-center">
          <p className="text-[10px] font-extrabold tracking-[0.14em] text-white/60">ROUND</p>
          <p className="font-display text-[20px] leading-none font-bold tabular-nums">
            {round}/{TURNS}
          </p>
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>

      <div className="mt-3 flex items-end justify-between px-1">
        <Score value={shown[me]} color={color(me)} />
        <div className="flex gap-1.5 pb-1" aria-label={`${st.left} swaps left`}>
          {Array.from({ length: Math.max(SWAPS, st.left) }, (_, k) => (
            <span
              key={k}
              className="h-2.5 w-6 rounded-full transition"
              style={{ background: k < st.left ? color(st.turn) : "rgba(255,255,255,0.15)", boxShadow: k < st.left ? `0 0 10px ${color(st.turn)}` : undefined }}
            />
          ))}
        </div>
        <Score value={shown[them]} color={color(them)} right />
      </div>

      <div className="relative mt-3 flex shrink-0 justify-center">
        <div
          className={clsx("relative aspect-square rounded-[24px] p-1.5", view.shake && "gm-shake")}
          style={{
            width: "min(100%, calc(100dvh - 290px))",
            background: "linear-gradient(180deg, #3c1766, #24093f)",
            boxShadow: "0 8px 0 #160428, 0 30px 60px -20px rgba(155,77,255,0.65), inset 0 0 0 1.5px rgba(255,255,255,0.12)",
          }}
        >
          <div
            ref={gridRef}
            className="relative grid h-full w-full touch-none overflow-hidden rounded-[18px] select-none"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (drag.current = null)}
          >
            {view.board.map((g, i) => {
              const [r, c] = rc(i);
              const from = view.slide?.[i];
              const fell = view.drop?.[i] ?? 0;
              const hinted = hint?.includes(i);
              return (
                <div
                  key={i}
                  onPointerDown={(e) => down(e, i)}
                  className="relative overflow-visible p-[7%]"
                  style={{ background: (r + c) % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)", borderRadius: 10 }}
                >
                  <span
                    key={`${view.key}-${i}`}
                    className={clsx(
                      "block h-full w-full transition-transform",
                      (from || fell > 0) && "gm-move",
                      view.pop?.has(i) && "gm-gem-pop",
                      sel === i && "scale-110",
                      hinted && "gm-pulse",
                    )}
                    style={
                      {
                        "--fx": `${from ? from[1] * 115 : 0}%`,
                        "--fy": `${from ? from[0] * 115 : -fell * 115}%`,
                        "--md": from ? "0.2s" : `${0.18 + Math.min(fell, 7) * 0.035}s`,
                      } as React.CSSProperties
                    }
                  >
                    <Gem g={g} />
                  </span>
                  {sel === i && <span className="pointer-events-none absolute inset-[3%] rounded-[10px] ring-[3px] ring-gold" />}
                </div>
              );
            })}
            {floats.map((f) => (
              <span
                key={f.id}
                className="gm-float-up pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-display text-[22px] font-black text-white [text-shadow:0_2px_0_#5a1a9a,0_0_12px_rgba(255,211,107,0.9)]"
                style={{ left: `${f.x}%`, top: `${f.y}%` }}
              >
                {f.text}
              </span>
            ))}
          </div>
          {toast && (
            <span key={toast.id} className="gm-stamp pointer-events-none absolute inset-x-0 top-[40%] mx-auto w-fit rounded-2xl bg-gold px-4 py-2 font-display text-[22px] font-black text-ink shadow-[0_6px_0_#b9831e]">
              {toast.text}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2 text-[11px] font-bold text-white/75">
        <Legend g="bh" text="4 in a row" />
        <Legend g="gx" text="L or T" />
        <Legend g="*" text="5 in a row" />
      </div>

      {stuck && (
        <button type="button" onClick={() => send({ type: "shuffle" })} className="gm-btn gm-gold mx-auto mt-3 inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold">
          <Shuffle size={18} /> Shuffle the board
        </button>
      )}
      <div className="flex-1" />
      <p className={clsx("mt-3 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (myTurn
            ? anim
              ? " "
              : st.left === 1
                ? "Last swap this turn. Make it count!"
                : "Swipe a gem to swap it with its neighbour"
            : game.status === "active"
              ? `${names.them} is playing…`
              : " ")}
      </p>
    </div>
  );
}

function Legend({ g, text }: { g: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/8 py-1 pr-2.5 pl-1">
      <span className="h-6 w-6">
        <Gem g={g} />
      </span>
      {text}
    </span>
  );
}

function Score({ value, color, right }: { value: number; color: string; right?: boolean }) {
  return (
    <p className={clsx("font-display text-[30px] leading-none font-black tabular-nums", right && "text-right")} style={{ color, textShadow: `0 0 18px ${color}66` }}>
      {value.toLocaleString()}
    </p>
  );
}
