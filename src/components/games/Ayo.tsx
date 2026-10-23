"use client";

import clsx from "clsx";
import type { Game, GameActions } from "@/lib/games";
import { legalMoves, WIN, type AyoState } from "@/lib/boardgames/ayo";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

/**
 * Ayo, standing up: the board fills the screen, your pits run down the right,
 * theirs down the left, and seeds go round anticlockwise (up your side, down theirs).
 */
export function Ayo({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as AyoState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, started } = useMove(game, act);
  const myTurn = game.status === "active" && started && st.turn === me;
  const legal = myTurn ? legalMoves(st, me) : [];
  const mineAll = me === "a" ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];

  // Top to bottom: your pits count down the right (you sow upwards), theirs count up the left
  const right = [...mineAll].reverse();
  const left = me === "a" ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
  const captured = new Set(st.last?.captured ?? []);

  const sub = (s: "a" | "b") => (st.turn === s && game.status === "active" ? (s === me ? "Your turn" : "Their turn") : `${st.store[s]} seeds`);

  function Pit({ i }: { i: number }) {
    const n = st.pits[i];
    const can = legal.includes(i);
    const isEnd = st.last?.end === i;
    return (
      <div className="grid min-h-0 place-items-center">
        <button
          type="button"
          disabled={!can || busy}
          onClick={() => send(i)}
          aria-label={`Pit with ${n} ${n === 1 ? "seed" : "seeds"}${can ? ". Tap to sow" : ""}`}
          className={clsx(
            "relative grid aspect-square h-full max-h-full w-auto max-w-full place-items-center rounded-full transition",
            can && !busy && "ring-[3px] ring-gold/90 active:scale-95",
            captured.has(i) && "gm-pulse",
          )}
          style={{
            background: "radial-gradient(circle at 50% 35%, #4a2a10 0%, #2b1606 75%)",
            boxShadow: isEnd ? "inset 0 4px 10px rgba(0,0,0,0.6), 0 0 0 3px #ffffff" : "inset 0 4px 10px rgba(0,0,0,0.6)",
          }}
        >
          <Seeds n={n} />
          <span className="absolute -bottom-1 rounded-full bg-black/55 px-2 text-[12px] leading-[18px] font-extrabold tabular-nums">{n}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2 pb-4">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {st.store[me]}–{st.store[them]}
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={sub(them)} />
      </div>

      <div
        className="mt-3 flex min-h-0 flex-1 flex-col rounded-[32px] p-3"
        style={{ background: "linear-gradient(90deg,#8a5220,#b9762f 50%,#8a5220)", boxShadow: "0 10px 0 #5a3412, 0 30px 60px -20px rgba(194,122,50,0.7)" }}
      >
        <Store n={st.store[them]} label={`${names.them} · left side`} color={color(them)} />
        <div className="my-2 grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] gap-x-2">
          <div className="grid min-h-0 grid-rows-6 gap-2">
            {left.map((i) => (
              <Pit key={i} i={i} />
            ))}
          </div>
          <div className="w-px bg-black/20" />
          <div className="grid min-h-0 grid-rows-6 gap-2">
            {right.map((i) => (
              <Pit key={i} i={i} />
            ))}
          </div>
        </div>
        <Store n={st.store[me]} label="You · right side" color={color(me)} />
      </div>

      <p className={clsx("mt-3 text-center text-[13px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/75")}>
        {note ??
          (myTurn
            ? legal.length && legal.length < mineAll.filter((i) => st.pits[i] > 0).length
              ? "They have no seeds. Pick a pit that gives them some"
              : "Tap one of your pits to sow · capture 2s and 3s"
            : game.status === "active"
              ? `${names.them} is thinking…`
              : `First to ${WIN} seeds wins`)}
      </p>
    </div>
  );
}

function Store({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-full bg-black/25 px-3 py-1.5">
      <span className="truncate text-[12px] font-bold text-white/80">{label}</span>
      <span className="shrink-0 text-[13px] font-extrabold tabular-nums" style={{ color }}>
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
