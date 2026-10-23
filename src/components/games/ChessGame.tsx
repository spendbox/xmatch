"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Square } from "chess.js";
import type { Game, GameActions } from "@/lib/games";
import { replay, type ChessState } from "@/lib/boardgames/chess";
import { Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";
import { ChessPiece, type PieceType } from "./ChessPieces";

const LIGHT = "#dfe6f2";
const DARK = "#5c6f94";
const WHITE = "#f7f3ea";
const NAMES: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const FILES = "abcdefgh";

export function ChessGame({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as ChessState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const { send, busy, note, started } = useMove(game, act);
  const [sel, setSel] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);

  const chess = useMemo(() => replay(st.san ?? []), [st.san]);
  const board = chess.board();
  const myColor = me === "a" ? "w" : "b";
  const myTurn = game.status === "active" && started && st.turn === me;
  const targets = useMemo(
    () => (myTurn && sel ? chess.moves({ square: sel, verbose: true }) : []),
    [chess, myTurn, sel],
  );

  // White at the bottom for a, black at the bottom for b
  const rows = me === "a" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = me === "a" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  async function tap(sq: Square) {
    if (!myTurn || busy) return;
    const piece = chess.get(sq);
    const hit = targets.filter((m) => m.to === sq);
    if (sel && hit.length) {
      if (hit.some((m) => m.promotion)) return setPromo({ from: sel, to: sq });
      const ok = await send({ from: sel, to: sq });
      if (ok) setSel(null);
      return;
    }
    if (piece && piece.color === myColor) setSel(sq === sel ? null : sq);
    else setSel(null);
  }

  async function promote(p: "q" | "r" | "b" | "n") {
    if (!promo) return;
    const ok = await send({ ...promo, promotion: p });
    setPromo(null);
    if (ok) setSel(null);
  }

  const kingInCheck = st.check ? chess.board().flat().find((p) => p && p.type === "k" && p.color === chess.turn())?.square : null;
  const sub = (s: "a" | "b") =>
    game.status !== "active" ? (s === "a" ? "White" : "Black") : st.turn === s ? (st.check ? "In check!" : s === me ? "Your move" : "Their move") : s === "a" ? "White" : "Black";

  return (
    <div className="flex h-full flex-col px-4 pt-2 pb-5">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={me === "a" ? WHITE : "#8a93a8"} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[15px] font-bold text-white/70 tabular-nums">Move {Math.floor((st.san?.length ?? 0) / 2) + 1}</div>
        <Player right name={names.them} color={them === "a" ? WHITE : "#8a93a8"} active={st.turn === them} sub={sub(them)} />
      </div>
      <Taken pieces={st.taken?.[them] ?? ""} color={myColor} label={`${names.them} took`} className="mt-3" />

      <div className="relative mt-2 rounded-[18px] p-1.5" style={{ background: "linear-gradient(180deg,#2b3650,#1a2233)", boxShadow: "0 10px 0 #0f1420, 0 30px 60px -20px rgba(75,93,128,0.7)" }}>
        <div className="grid grid-cols-8 overflow-hidden rounded-[12px]">
          {rows.map((r) =>
            cols.map((c) => {
              const sq = `${FILES[c]}${8 - r}` as Square;
              const p = board[r][c];
              const light = (r + c) % 2 === 0;
              const isTarget = targets.some((m) => m.to === sq);
              const isLast = st.last && (st.last.from === sq || st.last.to === sq);
              return (
                <button
                  key={sq}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => tap(sq)}
                  aria-label={`${sq}${p ? `, ${p.color === "w" ? "white" : "black"} ${NAMES[p.type]}` : ""}`}
                  className="relative grid aspect-square place-items-center"
                  style={{
                    background: kingInCheck === sq ? "#e5484d" : sel === sq ? "#f2b33d" : isLast ? (light ? "#f6e7a8" : "#b39a4c") : light ? LIGHT : DARK,
                  }}
                >
                  {p && <ChessPiece type={p.type} color={p.color} className="h-[88%] w-[88%]" />}
                  {isTarget && (
                    <span className={clsx("absolute rounded-full", p ? "inset-1 border-[3px] border-white/80" : "h-3 w-3 bg-[#1c1828]/40")} />
                  )}
                  {c === cols[0] && <span className="absolute top-0.5 left-1 text-[9px] font-bold text-[#1c1828]/50">{8 - r}</span>}
                  {r === rows[7] && <span className="absolute right-1 bottom-0 text-[9px] font-bold text-[#1c1828]/50">{FILES[c]}</span>}
                </button>
              );
            }),
          )}
        </div>
        {promo && (
          <div className="absolute inset-0 grid place-items-center rounded-[18px] bg-black/55">
            <div className="gm-burst rounded-[22px] bg-white p-3 text-ink">
              <p className="mb-2 text-center text-[13px] font-bold">Turn your pawn into</p>
              <div className="flex gap-2">
                {(["q", "r", "b", "n"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => promote(k)} aria-label={NAMES[k]} className="grid h-14 w-14 place-items-center rounded-2xl bg-cream">
                    <ChessPiece type={k} color={myColor} className="h-11 w-11" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Taken pieces={st.taken?.[me] ?? ""} color={myColor === "w" ? "b" : "w"} label="You took" className="mt-2" />

      <p className={clsx("mt-3 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (myTurn
            ? st.check
              ? "You're in check. Get your king to safety"
              : sel
                ? "Tap a highlighted square"
                : "Tap a piece to move"
            : game.status === "active"
              ? `${names.them} is thinking…`
              : st.last
                ? `Last move: ${st.last.san}`
                : "")}
      </p>
    </div>
  );
}

function Taken({ pieces, color, label, className }: { pieces: string; color: "w" | "b"; label: string; className?: string }) {
  if (!pieces) return <div className={clsx("h-5", className)} />;
  return (
    <p className={clsx("flex h-5 items-center gap-1 text-[11px] font-bold text-white/55", className)}>
      {label}
      <span className="flex">
        {[...pieces].map((p, k) => (
          <ChessPiece key={k} type={p as PieceType} color={color} className="-mx-0.5 h-5 w-5" />
        ))}
      </span>
    </p>
  );
}
