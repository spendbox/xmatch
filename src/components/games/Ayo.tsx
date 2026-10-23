"use client";

import clsx from "clsx";
import type { Game, GameActions } from "@/lib/games";
import { legalMoves, WIN, type AyoState } from "@/lib/boardgames/ayo";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

export function Ayo({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as AyoState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, started } = useMove(game, act);
  const myTurn = game.status === "active" && started && st.turn === me;
  const legal = myTurn ? legalMoves(st, me) : [];

  // Your row along the bottom, left to right; theirs along the top, sowing goes round anticlockwise
  const mineRow = me === "a" ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
  const theirRow = me === "a" ? [11, 10, 9, 8, 7, 6] : [5, 4, 3, 2, 1, 0];
  const captured = new Set(st.last?.captured ?? []);

  const sub = (s: "a" | "b") => (st.turn === s && game.status === "active" ? (s === me ? "Your turn" : "Their turn") : `${st.store[s]} seeds`);

  function Pit({ i }: { i: number }) {
    const n = st.pits[i];
    const can = legal.includes(i);
    const isEnd = st.last?.end === i;
    return (
      <button
        type="button"
        disabled={!can || busy}
        onClick={() => send(i)}
        aria-label={`Pit with ${n} ${n === 1 ? "seed" : "seeds"}${can ? ". Tap to sow" : ""}`}
        className={clsx(
          "relative grid aspect-square place-items-center rounded-full transition",
          can && !busy && "ring-[3px] ring-gold/90 active:scale-95",
          captured.has(i) && "gm-pulse",
        )}
        style={{
          background: "radial-gradient(circle at 50% 35%, #4a2a10 0%, #2b1606 75%)",
          boxShadow: isEnd ? "inset 0 4px 10px rgba(0,0,0,0.6), 0 0 0 3px #ffffff" : "inset 0 4px 10px rgba(0,0,0,0.6)",
        }}
      >
        <Seeds n={n} />
        <span className="absolute -bottom-1 rounded-full bg-black/55 px-1.5 text-[11px] leading-[16px] font-extrabold tabular-nums">{n}</span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 pt-2 pb-5">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {st.store[me]}–{st.store[them]}
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>
      <p className="mt-2.5 text-center text-[12px] font-bold text-white/60">First to {WIN} seeds wins</p>

      <div className="mt-5 rounded-[30px] p-3" style={{ background: "linear-gradient(180deg,#b9762f,#8a5220)", boxShadow: "0 10px 0 #5a3412, 0 30px 60px -20px rgba(194,122,50,0.7)" }}>
        <Store n={st.store[them]} label={names.them} color={color(them)} />
        <div className="mt-2 grid grid-cols-6 gap-2">
          {theirRow.map((i) => (
            <Pit key={i} i={i} />
          ))}
        </div>
        <div className="my-2.5 h-px bg-black/20" />
        <div className="grid grid-cols-6 gap-2">
          {mineRow.map((i) => (
            <Pit key={i} i={i} />
          ))}
        </div>
        <Store n={st.store[me]} label="You" color={color(me)} className="mt-2" />
      </div>

      <p className={clsx("mt-5 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (myTurn
            ? legal.length && legal.length < mineRow.filter((i) => st.pits[i] > 0).length
              ? "They have no seeds. Pick a pit that gives them some"
              : "Tap one of your pits to sow its seeds"
            : game.status === "active"
              ? `${names.them} is thinking…`
              : "")}
      </p>
      <p className="mt-1 text-center text-[12px] text-white/50">Capture when your last seed makes 2 or 3 on their side</p>
    </div>
  );
}

function Store({ n, label, color, className }: { n: number; label: string; color: string; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between rounded-full bg-black/25 px-3 py-1", className)}>
      <span className="truncate text-[12px] font-bold text-white/80">{label}</span>
      <span className="text-[13px] font-extrabold tabular-nums" style={{ color }}>
        {n} captured
      </span>
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
