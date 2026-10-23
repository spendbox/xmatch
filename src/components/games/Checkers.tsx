"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Crown } from "lucide-react";
import type { Game, GameActions } from "@/lib/games";
import { legalMoves, type CheckersState } from "@/lib/boardgames/checkers";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

const LIGHT = "#d9efe9";
const DARK = "#1d6b63";

export function Checkers({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as CheckersState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, started } = useMove(game, act);
  const [sel, setSel] = useState<number | null>(null);

  const myTurn = game.status === "active" && started && st.turn === me;
  const options = myTurn ? legalMoves(st, me) : [];
  const movable = new Set(options.map((o) => o.from));
  const mustTake = options.some((o) => o.take !== null);
  const chosen = st.chain ?? sel;
  const targets = options.filter((o) => o.from === chosen);

  // In the middle of a multi-jump, the jumping piece stays picked
  useEffect(() => {
    setSel(st.chain);
  }, [st.chain, st.moves]);

  // Your side at the bottom
  const at = (v: number) => (me === "a" ? v : 63 - v);

  async function tap(i: number) {
    if (!myTurn || busy) return;
    if (chosen !== null && targets.some((o) => o.to === i)) {
      const ok = await send({ from: chosen, to: i });
      if (ok) setSel(null);
      return;
    }
    if (st.chain === null && movable.has(i)) setSel(i === sel ? null : i);
  }

  const pieces = (s: "a" | "b") => [...st.board].filter((c) => c.toLowerCase() === s).length;
  const sub = (s: "a" | "b") =>
    st.turn === s && game.status === "active" ? (s === me ? (st.chain !== null ? "Keep jumping!" : "Your move") : "Their move") : `${pieces(s)} left · took ${st.captured[s]}`;

  return (
    <div className="flex h-full flex-col px-4 pt-2 pb-5">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {st.captured[me]}–{st.captured[them]}
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>

      <div className="mt-5 rounded-[22px] p-2" style={{ background: "linear-gradient(180deg,#0d4f49,#083a36)", boxShadow: "0 10px 0 #052a27, 0 30px 60px -20px rgba(20,145,138,0.6)" }}>
        <div className="grid grid-cols-8 overflow-hidden rounded-[14px]">
          {Array.from({ length: 64 }, (_, v) => {
            const i = at(v);
            const r = Math.floor(i / 8);
            const c = i % 8;
            const dark = (r + c) % 2 === 1;
            const ch = st.board[i];
            const owner = ch === "." || ch === "x" ? null : ch.toLowerCase();
            const isTarget = targets.some((o) => o.to === i);
            const isLast = st.last && (st.last.from === i || st.last.to === i);
            const canPick = movable.has(i) && st.chain === null;
            return (
              <button
                key={v}
                type="button"
                onClick={() => tap(i)}
                disabled={!myTurn}
                aria-label={`Square ${String.fromCharCode(97 + c)}${8 - r}${owner ? (owner === me ? ", your piece" : ", their piece") : ""}`}
                className="relative grid aspect-square place-items-center"
                style={{ background: dark ? (isLast ? "#2f8d82" : DARK) : LIGHT }}
              >
                {owner && (
                  <span
                    className={clsx(
                      "relative block aspect-square w-[78%] rounded-full transition",
                      chosen === i && "-translate-y-1 scale-110 shadow-[0_0_0_3px_#f2b33d,0_0_16px_6px_rgba(242,179,61,0.6)]",
                      canPick && !busy && chosen !== i && "gm-pulse shadow-[0_0_0_3px_#ffffff,0_0_14px_4px_rgba(255,255,255,0.55)]",
                    )}
                  >
                    <Piece side={owner as "a" | "b"} king={ch === ch.toUpperCase()} />
                  </span>
                )}
                {ch === "x" && <span className="h-[72%] w-[72%] rounded-full bg-black/25 ring-2 ring-white/30" aria-label="Taken this turn" />}
                {isTarget && <span className="absolute h-3.5 w-3.5 rounded-full bg-white/85 shadow-[0_0_0_4px_rgba(255,255,255,0.25)]" />}
              </button>
            );
          })}
        </div>
      </div>

      <p className={clsx("mt-5 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (myTurn
            ? st.chain !== null
              ? "Keep jumping with the same piece"
              : mustTake
                ? "You must capture. Tap a glowing piece"
                : chosen !== null
                  ? "Tap a dot to move there"
                  : "Tap one of your pieces"
            : game.status === "active"
              ? `${names.them} is thinking…`
              : "")}
      </p>
    </div>
  );
}

// Each side's disc colour and a slightly darker shade of it for the ridge and crown
const SHADES = { a: { base: GOLD, deep: "#c98b1c" }, b: { base: PURPLE, deep: "#7f62e0" } };

/** A checkers piece: a plain disc with a ridge, a crown for kings */
function Piece({ side, king }: { side: "a" | "b"; king: boolean }) {
  const { base, deep } = SHADES[side];
  return (
    <span
      className="grid aspect-square w-full place-items-center rounded-full"
      style={{ background: base, boxShadow: `inset 0 -4px 0 ${deep}, 0 3px 6px rgba(0,0,0,0.35)` }}
    >
      <span className="grid h-[62%] w-[62%] place-items-center rounded-full" style={{ boxShadow: `inset 0 0 0 2.5px ${deep}` }}>
        {king && <Crown size={14} strokeWidth={2.8} style={{ color: deep }} />}
      </span>
    </span>
  );
}
