"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import {
  MAX_MARKS,
  WIN_ROUNDS,
  nextToVanish,
  type XOState,
} from "@/lib/boardgames/xo";
import type { Side } from "@/lib/boardgames/types";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";
import { GamePop, usePops } from "./GamePop";

/** How long a won round's board stays up before the fresh one */
const ROUND_HOLD = 1900;

/**
 * X & O, the vanishing kind: only 3 marks each, so your 4th makes your oldest disappear.
 * X is the player who started the game (gold), O the other (purple). First to 3 rounds.
 */
export function XO({
  game,
  names,
  act,
}: {
  game: Game;
  names: Names;
  act: GameActions;
}) {
  useTicker(500);
  const st = game.state as XOState;
  const me = game.me;
  const them: Side = me === "a" ? "b" : "a";
  const { send, busy, note, started } = useMove(game, act);
  const pops = usePops();
  const [pending, setPending] = useState<number | null>(null);
  // A won round: its board (with the winning line) stays up for a moment
  const [shown, setShown] = useState<{
    board: string;
    line: number[];
    winner: Side;
  } | null>(null);
  // Marks that just vanished, fading out
  const [ghost, setGhost] = useState<{
    cell: number;
    side: Side;
    key: number;
  } | null>(null);
  const seen = useRef(st.moves);

  const myTurn =
    game.status === "active" && started && st.turn === me && !shown;
  const board = shown?.board ?? st.board;

  // Something happened: play it out
  useEffect(() => {
    if (st.moves === seen.current) return;
    const jump = st.moves !== seen.current + 1;
    seen.current = st.moves;
    setPending(null);
    const l = st.last;
    if (!l || jump) return;
    if (l.by !== me) sfx("drop");
    if (l.removed !== undefined)
      setGhost({ cell: l.removed, side: l.by, key: st.moves });
    if (l.roundWon) {
      setShown(l.roundWon);
      const mine = l.roundWon.winner === me;
      const over = game.status !== "active";
      if (!over) {
        setTimeout(
          () =>
            pops.show(
              mine
                ? {
                    title: "3 in a row!",
                    sub: `You take round ${st.rounds.length} · ${st.wins[me]}–${st.wins[them]}`,
                    tone: "good",
                  }
                : {
                    title: `${names.them} wins the round`,
                    sub: `${st.wins[me]}–${st.wins[them]} · you start the next one`,
                    tone: "bad",
                    gift: `Nice one. Send ${names.them} a 🔥`,
                  },
            ),
          350,
        );
      }
      const t = setTimeout(() => setShown(null), ROUND_HOLD);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.moves]);

  useEffect(() => {
    if (!ghost) return;
    const t = setTimeout(() => setGhost(null), 700);
    return () => clearTimeout(t);
  }, [ghost]);

  // The match is over
  const ended = game.status === "done";
  useEffect(() => {
    if (!ended || !game.winner) return;
    const t = setTimeout(
      () =>
        pops.show(
          game.winner === (me === "a" ? game.player_a : game.player_b)
            ? {
                title: "You win!",
                sub: `${st.wins[me]}–${st.wins[them]} · first to ${WIN_ROUNDS}`,
                tone: "win",
                gift: `Good game. Send ${names.them} a gift`,
              }
            : {
                title: `${names.them} wins`,
                sub: `${st.wins[them]}–${st.wins[me]} · so close`,
                tone: "bad",
                gift: "Say well played with a gift",
              },
        ),
      700,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  async function tap(cell: number) {
    if (!myTurn || busy || board[cell] !== "." || pending !== null) return;
    buzz(12);
    sfx("tap");
    setPending(cell);
    const ok = await send({ cell });
    if (!ok) setPending(null);
  }

  // The marks that go next (faded as a warning); mine counts the one I'm placing
  const myNext = nextToVanish(st, me);
  const theirNext = nextToVanish(st, them);
  const myCount = st.order[me].length;
  const color = (s: Side) => (s === "a" ? GOLD : PURPLE);
  const line = shown?.line ?? null;

  const status =
    note ??
    (shown
      ? shown.winner === me
        ? "Round to you!"
        : `Round to ${names.them}`
      : !started
        ? "Get ready…"
        : myTurn
          ? myCount >= MAX_MARKS
            ? "Your faded mark vanishes when you place this one"
            : `Your turn · ${MAX_MARKS - myCount} more before they start vanishing`
          : game.status === "active"
            ? `${names.them} is thinking…`
            : "");

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden px-3 pt-2 pb-3">
      <div className="flex items-center gap-2.5">
        <Player
          name="You"
          photo={names.mePhoto}
          color={color(me)}
          active={!shown && st.turn === me}
          sub={`${me === "a" ? "X" : "O"} · ${st.wins[me]} won`}
        />
        <div className="text-[13px] font-bold text-white/60">vs</div>
        <Player
          right
          name={names.them}
          photo={names.themPhoto}
          onClick={names.onThem}
          color={color(them)}
          active={!shown && st.turn === them}
          sub={`${them === "a" ? "X" : "O"} · ${st.wins[them]} won`}
        />
      </div>

      {/* Rounds: first to 3 */}
      <div
        className="mt-3 flex shrink-0 items-center justify-center gap-1.5"
        aria-label={`Round ${st.round}. You ${st.wins[me]}, ${names.them} ${st.wins[them]}`}
      >
        {Array.from({ length: WIN_ROUNDS * 2 - 1 }, (_, i) => {
          const w = st.rounds[i];
          return (
            <span
              key={i}
              className={clsx(
                "grid h-7 w-7 place-items-center rounded-full text-[12px] font-black transition",
                w
                  ? "text-ink"
                  : i === st.rounds.length
                    ? "bg-white/20 text-white ring-2 ring-white/40"
                    : "bg-white/8 text-white/40",
              )}
              style={
                w
                  ? {
                      background: color(w),
                      boxShadow: `0 3px 0 ${w === "a" ? "#b9831e" : "#5b3fb5"}`,
                    }
                  : undefined
              }
            >
              {w ? (w === "a" ? "X" : "O") : i + 1}
            </span>
          );
        })}
        <span className="ml-1.5 text-[11px] font-extrabold tracking-[0.12em] text-white/55 uppercase">
          First to {WIN_ROUNDS}
        </span>
      </div>

      {/* The board */}
      {/* As big as the space allows: the full width, or the full height on short screens */}
      <div className="my-2 grid min-h-0 flex-1 place-items-center" style={{ containerType: "size" }}>
        <div className="relative aspect-square" style={{ width: "min(100cqw, 100cqh, 560px)" }}>
          <div
            className={clsx(
              "grid h-full w-full grid-cols-3 gap-2.5 rounded-[30px] p-2.5 transition",
              shown && "gm-shake",
            )}
            style={{
              background: "rgba(4,22,36,0.6)",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.08), 0 24px 50px -20px rgba(0,0,0,0.85)",
            }}
          >
            {Array.from({ length: 9 }, (_, i) => {
              const v = pending === i ? me : board[i];
              const mark = v === "a" || v === "b" ? (v as Side) : null;
              const fading =
                !shown &&
                pending === null &&
                mark !== null &&
                ((mark === me && myNext === i) ||
                  (mark === them && theirNext === i));
              const won = line?.includes(i);
              const free = !mark && myTurn;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(i)}
                  disabled={!free || busy}
                  aria-label={
                    mark
                      ? `${mark === "a" ? "X" : "O"}${fading ? ", vanishes next" : ""}`
                      : `Empty square ${i + 1}`
                  }
                  className={clsx(
                    "relative grid place-items-center rounded-[20px] transition",
                    won ? "bg-white/25" : "bg-white/[0.07]",
                    free && "hover:bg-white/[0.13] active:scale-95",
                  )}
                >
                  {mark && (
                    <span
                      key={`${mark}-${st.moves}-${i}`}
                      className={clsx(
                        "grid h-[72%] w-[72%] place-items-center",
                        pending === i || st.last?.cell === i
                          ? "gm-stamp-in"
                          : "",
                        fading && "xo-fade",
                      )}
                    >
                      {mark === "a" ? (
                        <XMark glow={won} />
                      ) : (
                        <OMark glow={won} />
                      )}
                    </span>
                  )}
                  {ghost && ghost.cell === i && !mark && (
                    <span
                      key={ghost.key}
                      className="xo-vanish absolute grid h-[72%] w-[72%] place-items-center"
                    >
                      {ghost.side === "a" ? <XMark /> : <OMark />}
                    </span>
                  )}
                  {fading && (
                    <span className="absolute bottom-1.5 rounded-full bg-black/40 px-1.5 text-[9px] font-black tracking-wide text-white/90 uppercase">
                      next to go
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {line && <WinLine line={line} />}
        </div>
      </div>

      <p
        className={clsx(
          "min-h-[40px] shrink-0 text-center text-[14px] leading-snug font-semibold",
          note ? "text-[#ffd0d0]" : "text-white/80",
        )}
      >
        {status}
      </p>

      <GamePop pop={pops.pop} />
    </div>
  );
}

/** The glowing line through a winning row */
function WinLine({ line }: { line: number[] }) {
  const pos = (i: number) => ({
    x: 16.7 + (i % 3) * 33.3,
    y: 16.7 + Math.floor(i / 3) * 33.3,
  });
  const a = pos(line[0]);
  const b = pos(line[2]);
  // Run a little past the end squares
  const dx = (b.x - a.x) * 0.12;
  const dy = (b.y - a.y) * 0.12;
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <line
        x1={a.x - dx}
        y1={a.y - dy}
        x2={b.x + dx}
        y2={b.y + dy}
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        className="xo-line"
        style={{ filter: "drop-shadow(0 0 6px #ffd36b)" }}
      />
    </svg>
  );
}

export function XMark({ glow }: { glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      className="h-full w-full"
      style={glow ? { filter: "drop-shadow(0 0 12px #ffd36b)" } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id="xo-gx" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f2b33d" />
        </linearGradient>
      </defs>
      <path
        d="M14 14 L46 46 M46 14 L14 46"
        stroke="#b9831e"
        strokeWidth="13"
        strokeLinecap="round"
        transform="translate(0 3)"
      />
      <path
        d="M14 14 L46 46 M46 14 L14 46"
        stroke="url(#xo-gx)"
        strokeWidth="12"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OMark({ glow }: { glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      className="h-full w-full"
      style={glow ? { filter: "drop-shadow(0 0 12px #c4b5fd)" } : undefined}
      aria-hidden
    >
      <circle
        cx="30"
        cy="33"
        r="18"
        fill="none"
        stroke="#4c2fb0"
        strokeWidth="11"
      />
      <circle
        cx="30"
        cy="30"
        r="18"
        fill="none"
        stroke="#a78bfa"
        strokeWidth="11"
      />
    </svg>
  );
}
