"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Lock } from "lucide-react";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { BOMBS, CELLS, SAFE, WINS_NEEDED, fieldOf, safeFound, type BombState } from "@/lib/boardgames/bomb";
import { BigButton, GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

/** A cartoon bomb with a lit fuse */
export function BombIcon({ className, lit = true, dim }: { className?: string; lit?: boolean; dim?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden style={dim ? { opacity: 0.5 } : undefined}>
      <defs>
        <radialGradient id="gm-bomb" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#5b5670" />
          <stop offset="0.55" stopColor="#24202f" />
          <stop offset="1" stopColor="#0d0b12" />
        </radialGradient>
      </defs>
      <path d="M40 16c4-7 10-8 14-5" fill="none" stroke="#c9a26a" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="33" y="14" width="12" height="9" rx="2.5" transform="rotate(35 39 18.5)" fill="#3a3548" />
      <circle cx="28" cy="38" r="21" fill="url(#gm-bomb)" />
      <ellipse cx="20" cy="29" rx="6" ry="3.5" fill="#fff" opacity="0.35" transform="rotate(-35 20 29)" />
      {lit && (
        <g className="gm-pulse" style={{ transformOrigin: "55px 10px" }}>
          <circle cx="55" cy="10" r="6" fill="#ffd36b" opacity="0.55" />
          <path d="m55 3 1.6 4.6L61 6l-2.6 4 4 2.6-4.8.4.4 4.8L55 15l-3 2.8.4-4.8-4.8-.4 4-2.6L49 6l4.4 1.6Z" fill="#ffb02e" />
          <circle cx="55" cy="10" r="2.2" fill="#fff6c8" />
        </g>
      )}
    </svg>
  );
}

/** Bombshell: hide 3 bombs, then find the other player's safe tiles before you set off all 3 of theirs */
export function Bombshell({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as BombState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, setNote, started } = useMove(game, act);
  const [picks, setPicks] = useState<number[]>([]);
  const [blast, setBlast] = useState<{ id: number; cell: number; mine: boolean } | null>(null);
  const seen = useRef(JSON.stringify(st.last));
  const playRef = useRef<HTMLDivElement>(null);

  const myBombs = ((game.mine?.bombs as number[] | undefined) ?? []).filter((n) => Number.isInteger(n));
  const ready = st[`ready_${me}`];
  const theyReady = st[`ready_${them}`];
  const myTurn = game.status === "active" && started && st.phase === "play" && st.turn === me;

  // New round: clear the picks
  useEffect(() => {
    setPicks([]);
  }, [st.round]);

  // React to each tile opening
  const lastKey = JSON.stringify(st.last);
  useEffect(() => {
    if (lastKey === seen.current) return;
    seen.current = lastKey;
    const l = st.last;
    if (!l) return;
    if (l.bomb) {
      setBlast({ id: st.moves, cell: l.cell, mine: l.by === me });
      playRef.current?.animate(
        [{ transform: "none" }, { transform: "translate(-7px,3px)" }, { transform: "translate(6px,-3px)" }, { transform: "translate(-4px,2px)" }, { transform: "none" }],
        { duration: 450 },
      );
      sfx(l.by === me ? "bad" : "match");
      buzz(l.by === me ? [70, 40, 120] : [20, 30, 20]);
      setTimeout(() => setBlast((b) => (b?.id === st.moves ? null : b)), 900);
    } else {
      sfx("flip");
      buzz(8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);

  async function hide() {
    const move = { type: "hide", cells: picks };
    let ok = await send(move);
    // Both of you locked in at the same moment: try once more
    if (!ok) {
      setNote(null);
      ok = await send(move);
    }
  }

  const sub = (s: "a" | "b") => {
    if (game.status !== "active") return `${st.wins[s]} ${st.wins[s] === 1 ? "round" : "rounds"}`;
    if (st.phase === "hide") return st[`ready_${s}`] ? "Bombs hidden" : "Hiding bombs…";
    return st.turn === s ? (s === me ? "Your pick" : "Picking…") : `${safeFound(st, s)}/${SAFE} safe`;
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col px-4 pt-2 pb-5">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.phase === "play" ? st.turn === me : !ready} sub={sub(me)} />
        <div className="text-center">
          <p className="text-[10px] font-extrabold tracking-[0.14em] text-white/60">ROUND {st.round}</p>
          <p className="font-display text-[22px] leading-none font-bold tabular-nums">
            {st.wins[me]}–{st.wins[them]}
          </p>
        </div>
        <Player right name={names.them} color={color(them)} active={st.phase === "play" ? st.turn === them : !theyReady} sub={sub(them)} />
      </div>

      {st.result && (st.phase === "hide" || game.status !== "active") && <RoundResult st={st} me={me} names={names} final={game.status !== "active"} />}

      {st.phase === "hide" && game.status === "active" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <p className={clsx("font-display leading-tight font-bold", st.result ? "mt-3 text-[22px]" : "text-[26px]")}>{ready ? "Bombs hidden" : "Hide your 3 bombs"}</p>
          <p className="mt-1 text-center text-[14px] text-white/70">
            {ready
              ? theyReady
                ? "Starting…"
                : `Waiting for ${names.them} to hide theirs…`
              : `${names.them} will try to dodge them. Tap 3 tiles.`}
          </p>
          <Field
            className={clsx("w-full", st.result ? "mt-4 max-w-[230px]" : "mt-6 max-w-[300px]")}
            cells={Array.from({ length: CELLS }, (_, i) => {
              const on = ready ? myBombs.includes(i) : picks.includes(i);
              return { state: on ? "bomb-own" : "closed", tap: !ready && started };
            })}
            onTap={(i) => {
              buzz(8);
              sfx("tap");
              setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < BOMBS ? [...p, i] : [...p.slice(1), i]));
            }}
          />
          {!ready && (
            <BigButton onClick={hide} disabled={picks.length !== BOMBS || busy || !started} className="mt-7 w-full max-w-[300px]">
              <Lock size={18} /> {picks.length === BOMBS ? "Lock them in" : `Pick ${BOMBS - picks.length} more`}
            </BigButton>
          )}
          {ready && <BombIcon className="gm-hover mt-6 h-14 w-14" />}
        </div>
      ) : (
        <div ref={playRef} className="flex min-h-0 flex-1 flex-col items-center">
          <div className="mt-3 flex w-full items-center justify-between" style={{ maxWidth: "min(320px, calc(100dvh - 390px))" }}>
            <p className="text-[13px] font-extrabold tracking-wide text-white/85">{names.them}&apos;s field</p>
            <Lives used={st[`boom_${me}`]} />
          </div>
          <Field
            className="mt-2 w-full"
            style={{ maxWidth: "min(320px, calc(100dvh - 390px))" }}
            cells={[...fieldOf(st, me)].map((c) => ({ state: c === "s" ? "safe" : c === "x" ? "boom" : "closed", tap: myTurn && !busy && c === "." }))}
            blast={blast && blast.mine ? blast.cell : null}
            onTap={(i) => send({ type: "pick", cell: i })}
          />
          <p className={clsx("mt-3 min-h-[20px] text-center text-[14px]", note ? "font-semibold text-[#ffb4b4]" : "text-white/80")}>
            {note ??
              (game.status !== "active"
                ? " "
                : myTurn
                  ? `Pick a tile. ${SAFE - safeFound(st, me)} safe ${SAFE - safeFound(st, me) === 1 ? "tile" : "tiles"} to go`
                  : `${names.them} is picking from your field…`)}
          </p>

          <div className="mt-auto w-full max-w-[170px]">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[12px] font-bold text-white/70">Your field</p>
              <Lives used={st[`boom_${them}`]} small />
            </div>
            <Field
              small
              cells={[...fieldOf(st, them)].map((c, i) => ({
                state: c === "s" ? "safe" : c === "x" ? "boom" : myBombs.includes(i) ? "bomb-own" : "closed",
              }))}
              blast={blast && !blast.mine ? blast.cell : null}
            />
          </div>
        </div>
      )}

      {blast?.mine && <div key={blast.id} aria-hidden className="gm-flash pointer-events-none absolute inset-0 bg-[#ff3b1f]" />}
    </div>
  );
}

type Cell = { state: "closed" | "safe" | "boom" | "bomb-own"; tap?: boolean };

/** A 3×3 field of tiles */
function Field({
  cells,
  onTap,
  blast,
  small,
  className,
  style,
}: {
  cells: Cell[];
  onTap?: (i: number) => void;
  blast?: number | null;
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={clsx("grid grid-cols-3 rounded-[24px]", small ? "gap-1.5 p-1.5" : "gap-2.5 p-2.5", className)}
      style={{ background: "linear-gradient(180deg,#4a1a0b,#2a0d05)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.08)", ...style }}
    >
      {cells.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={!c.tap}
          onClick={() => onTap?.(i)}
          aria-label={`Tile ${i + 1}: ${c.state === "closed" ? "closed" : c.state === "safe" ? "safe" : c.state === "boom" ? "bomb went off" : "your bomb"}`}
          className={clsx(
            "relative grid aspect-square place-items-center transition",
            small ? "rounded-[12px]" : "rounded-[18px]",
            c.tap && "active:translate-y-1",
            c.state === "safe" && "gm-flip",
          )}
          style={tileStyle(c, small)}
        >
          {c.state === "closed" && !small && <span className="font-display text-[26px] font-black text-[#8a3a12]/45">?</span>}
          {c.state === "safe" && <Check size={small ? 16 : 30} strokeWidth={3.2} className="text-white" />}
          {(c.state === "boom" || c.state === "bomb-own") && (
            <BombIcon className={small ? "h-[70%] w-[70%]" : "h-[64%] w-[64%]"} lit={c.state === "bomb-own"} dim={false} />
          )}
          {blast === i && (
            <>
              <span className="gm-boom pointer-events-none absolute inset-[-30%] rounded-full" style={{ background: "radial-gradient(circle, #fff6c8 0%, #ffb02e 35%, #ff3b1f 60%, transparent 72%)" }} />
              <span className="gm-stamp pointer-events-none absolute -top-3 font-display text-[18px] font-black text-white [text-shadow:0_2px_0_#8a2410]">BOOM</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function tileStyle(c: Cell, small?: boolean): React.CSSProperties {
  if (c.state === "safe") return { background: "linear-gradient(180deg,#34c27a,#178a50)", boxShadow: "inset 0 -3px 0 #0e5c35" };
  if (c.state === "boom") return { background: "radial-gradient(circle at 50% 45%, #ff6a3d 0%, #a3200a 70%)", boxShadow: "inset 0 -3px 0 #5a1005, 0 0 18px rgba(255,80,30,0.55)" };
  if (c.state === "bomb-own")
    return { background: "linear-gradient(180deg,#ffd9b0,#f3a46b)", boxShadow: `inset 0 -${small ? 3 : 5}px 0 #b55a24, 0 0 0 3px ${GOLD}` };
  return {
    background: c.tap ? "linear-gradient(180deg,#ffe0bd,#f6a56a)" : "linear-gradient(180deg,#e9c3a0,#d08c5a)",
    boxShadow: `inset 0 -${small ? 3 : 6}px 0 #a24a1c, 0 ${small ? 2 : 4}px 10px rgba(0,0,0,0.35)`,
    opacity: c.tap === false ? 0.92 : 1,
  };
}

/** Three bombs: the ones already set off are greyed out */
function Lives({ used, small }: { used: number; small?: boolean }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${BOMBS - used} of ${BOMBS} bombs left before losing`}>
      {Array.from({ length: BOMBS }, (_, k) => (
        <span key={k} className={clsx("grid place-items-center", small ? "h-5 w-5" : "h-7 w-7", k < used && "grayscale")} style={k < used ? { opacity: 0.3 } : undefined}>
          <BombIcon className="h-full w-full" lit={k >= used} />
        </span>
      ))}
    </span>
  );
}

/** How the last round ended, with both fields shown */
function RoundResult({ st, me, names, final }: { st: BombState; me: "a" | "b"; names: Names; final: boolean }) {
  const r = st.result!;
  const them = me === "a" ? "b" : "a";
  const won = r.winner === me;
  const why =
    r.why === "boom" ? (won ? `${names.them} set off all 3 of your bombs` : "You set off all 3 of their bombs") : won ? "You found all 6 safe tiles" : `${names.them} found all 6 safe tiles`;
  const mini = (owner: "a" | "b") =>
    Array.from({ length: CELLS }, (_, i): Cell => {
      const opened = r.open[owner][i];
      if (opened === "x") return { state: "boom" };
      if (r.bombs[owner].includes(i)) return { state: "bomb-own" };
      if (opened === "s") return { state: "safe" };
      return { state: "closed" };
    });
  return (
    <div className="gm-burst mt-3 rounded-[22px] bg-white/10 p-3">
      <p className="text-center font-display text-[20px] font-bold" style={{ color: won ? GOLD : "#ffb4b4" }}>
        {final ? (won ? "You win!" : `${names.them} wins`) : `Round ${r.round} ${won ? "to you!" : `to ${names.them}`}`}
      </p>
      <p className="text-center text-[13px] text-white/75">
        {why}
        {!final && ` · first to ${WINS_NEEDED}`}
      </p>
      <div className="mt-2.5 flex justify-center gap-4">
        {(["me", "them"] as const).map((w) => (
          <div key={w} className="w-[104px]">
            <Field small cells={mini(w === "me" ? me : them)} />
            <p className="mt-1 text-center text-[11px] font-bold text-white/65">{w === "me" ? "Your bombs" : `${names.them}'s bombs`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
