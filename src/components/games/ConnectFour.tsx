"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDown } from "lucide-react";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { GOLD, PURPLE, Player, secondsLeft, useTicker, type Names } from "./parts";

const EMPTY = "#0d1647";

export function ConnectFour({
  game,
  names,
  act,
  peek,
  onPeek,
}: {
  game: Game;
  names: Names;
  act: GameActions;
  /** Their latest chat message, shown at the bottom */
  peek?: string | null;
  onPeek?: () => void;
}) {
  useTicker(250);
  const st = game.state;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const [aim, setAim] = useState<number | null>(null);
  /** A disc you just tapped, until the server has it (which move and round it was tapped on) */
  const [pending, setPending] = useState<{ col: number; moves: number; round: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const pauseLeft = secondsLeft(st.pause_until, act.now);
  const showingPrev = !!st.prev && (pauseLeft > 0 || game.status !== "active");
  const board: string = showingPrev ? st.prev.board : st.board;
  const line: number[] = showingPrev ? (st.prev.line ?? []) : [];
  const myTurn = game.status === "active" && st.turn === me && !showingPrev && secondsLeft(game.started_at, act.now) <= 0;

  // Drop the pending disc as soon as the server has it (or after a few seconds, if it didn't take)
  useEffect(() => {
    setPending(null);
  }, [st.moves, st.round]);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 4000);
    return () => clearTimeout(t);
  }, [pending]);

  // Sounds and buzz for each new disc and round result
  const lastSeen = useRef<string>("");
  useEffect(() => {
    const key = `${st.round}-${st.moves}`;
    if (lastSeen.current && lastSeen.current !== key && st.moves > 0) sfx("drop");
    lastSeen.current = key;
  }, [st.round, st.moves]);
  const prevRound = useRef<number | null>(null);
  useEffect(() => {
    const r = st.prev?.round ?? null;
    if (r !== null && prevRound.current !== null && r !== prevRound.current) {
      const w = st.prev.winner;
      if (w === me) {
        sfx("win");
        buzz([20, 40, 60]);
      } else if (w === them) {
        sfx("lose");
        buzz(60);
      }
    }
    prevRound.current = r;
  }, [st.prev?.round, st.prev?.winner, me, them]);

  // A disc you just tapped shows right away. Once the server's board has the move, the real disc
  // takes its place in the same cell (never the copy one row higher, which made it drop twice)
  let shown = board;
  let pendingCell = -1;
  if (pending && !showingPrev && pending.moves === st.moves && pending.round === st.round) {
    for (let r = 5; r >= 0; r--) {
      if (shown[r * 7 + pending.col] === ".") {
        pendingCell = r * 7 + pending.col;
        shown = shown.slice(0, pendingCell) + me + shown.slice(pendingCell + 1);
        break;
      }
    }
  }
  const lastCell = showingPrev ? -1 : pendingCell >= 0 ? pendingCell : (st.last as number | null) ?? -1;

  async function drop(col: number) {
    if (!myTurn || pending) return;
    if (board[col] !== ".") {
      setNote("That column is full");
      sfx("bad");
      return;
    }
    setNote(null);
    setPending({ col, moves: st.moves, round: st.round });
    buzz(12);
    const { error } = await act.call("play_c4", { p_game: game.id, p_col: col });
    if (error) {
      setPending(null);
      setNote(error);
    }
  }

  const wins = st.wins ?? { a: 0, b: 0 };
  const roundNote = showingPrev
    ? st.prev.winner === "draw"
      ? "Draw! Board full"
      : st.prev.winner === me
        ? `You won round ${st.prev.round}!`
        : `${names.them} won round ${st.prev.round}`
    : null;

  return (
    <div className="flex h-full flex-col px-4 pt-2 pb-5">
      {/* Players */}
      <div className="flex items-center gap-2.5">
        <Player
          name="You"
          color={color(me)}
          active={st.turn === me && !showingPrev}
          sub={st.turn === me && !showingPrev ? "Your move" : "Waiting"}
        />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {wins[me]}–{wins[them]}
        </div>
        <Player
          right
          name={names.them}
          color={color(them)}
          active={st.turn === them && !showingPrev}
          sub={st.turn === them && !showingPrev ? "Their move" : "Waiting"}
        />
      </div>
      <p className="mt-2.5 text-center text-[12px] font-bold text-white/60">
        Game {Math.min(3, st.round)} of 3 · {wins.a === 1 && wins.b === 1 && !showingPrev ? "decider" : "best of 3"}
      </p>

      {/* Aim row */}
      <div className="mt-4 grid grid-cols-7 gap-1.5 px-2.5">
        {Array.from({ length: 7 }, (_, c) => (
          <div key={c} className="grid h-10 place-items-center">
            {myTurn && aim === c && !pending && (
              <span
                className="gm-hover block aspect-square w-[86%] rounded-full opacity-90"
                style={{ background: color(me), boxShadow: `inset 0 -5px 0 rgba(0,0,0,0.18), 0 10px 24px -6px ${color(me)}` }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Board */}
      <div
        className={clsx("relative rounded-[26px] p-2.5", showingPrev && st.prev.winner === me && "gm-shake")}
        style={{ background: "linear-gradient(180deg, #3a5bff 0%, #2541c9 100%)", boxShadow: "0 10px 0 #182c8a, 0 30px 60px -20px rgba(58,91,255,0.7)" }}
        onPointerLeave={() => setAim(null)}
      >
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 42 }, (_, i) => {
            const v = shown[i];
            const r = Math.floor(i / 7);
            const c = i % 7;
            const filled = v === "a" || v === "b";
            const isNew = i === lastCell && filled;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Column ${c + 1}`}
                disabled={!myTurn}
                onPointerEnter={() => setAim(c)}
                onClick={() => drop(c)}
                className="relative aspect-square rounded-full"
                style={{ background: EMPTY, boxShadow: "inset 0 4px 8px rgba(0,0,0,0.55)" }}
              >
                {filled && (
                  <span
                    // The same key before and after the server confirms your move, so it only drops once
                    key={isNew ? `n-${st.round}-${i}` : `s-${i}`}
                    className={clsx("absolute inset-0 rounded-full", isNew && "gm-drop", line.includes(i) && "gm-win-cell")}
                    style={
                      {
                        background: color(v),
                        boxShadow: line.includes(i)
                          ? undefined
                          : isNew
                            ? "inset 0 -5px 0 rgba(0,0,0,0.2), 0 0 0 3px #fff"
                            : "inset 0 -5px 0 rgba(0,0,0,0.2)",
                        "--from": `-${(r + 1) * 118}%`,
                      } as React.CSSProperties
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
        {roundNote && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="gm-burst rounded-2xl bg-white px-5 py-3 font-display text-[22px] font-bold text-[#121a4a] shadow-[0_6px_0_rgba(0,0,0,0.25)]">
              {roundNote}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[13px] text-white/75">
        {note ? (
          <span className="font-semibold text-[#ffb4b4]">{note}</span>
        ) : myTurn ? (
          <>
            <ArrowDown size={16} /> Tap a column to drop your disc
          </>
        ) : game.status === "active" && !showingPrev ? (
          <>{names.them} is thinking…</>
        ) : null}
      </div>

      {peek && (
        <div className="mt-auto flex items-center gap-2.5 rounded-[18px] bg-white/10 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
            {names.them}: &ldquo;{peek}&rdquo;
          </span>
          <button type="button" onClick={onPeek} className="gm-btn h-9 shrink-0 rounded-xl bg-white/15 px-3.5 text-[13px] font-bold">
            Reply
          </button>
        </div>
      )}
    </div>
  );
}
