"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { afterRoll, HOME, legal, moveToken, pick, SAFE, START, won, type LudoState } from "@/lib/boardgames/ludo";
import { useMove } from "./useMove";
import { other, type Side } from "@/lib/boardgames/types";
import { GOLD, PURPLE, Player, type Names } from "./parts";
import { DiceArt, GamePop, usePops } from "./GamePop";
import { DiceTray, TokenArt } from "./BoardBits";

const C = 40; // one square in board units (the board is 15 × 15)
type RC = [number, number];

// The shared 52-square track, starting at the top-left player's start square and going clockwise
const TRACK: RC[] = (
  [
  ...[1, 2, 3, 4, 5].map((c) => [6, c] as RC),
  ...[5, 4, 3, 2, 1, 0].map((r) => [r, 6] as RC),
  [0, 7],
  ...[0, 1, 2, 3, 4, 5].map((r) => [r, 8] as RC),
  ...[9, 10, 11, 12, 13, 14].map((c) => [6, c] as RC),
  [7, 14],
  ...[14, 13, 12, 11, 10, 9].map((c) => [8, c] as RC),
  ...[9, 10, 11, 12, 13, 14].map((r) => [r, 8] as RC),
  [14, 7],
  ...[14, 13, 12, 11, 10, 9].map((r) => [r, 6] as RC),
  ...[5, 4, 3, 2, 1, 0].map((c) => [8, c] as RC),
  [7, 0],
  [6, 0],
  ] as RC[]
).slice(0, 52);

const LANE: Record<Side, RC[]> = { a: [13, 12, 11, 10, 9].map((c) => [7, c] as RC), b: [1, 2, 3, 4, 5].map((c) => [7, c] as RC) };
const YARD: Record<Side, RC> = { a: [9, 9], b: [0, 0] };
const NEST: RC[] = [[2, 2], [2, 4], [4, 2], [4, 4]];
const COLORS: Record<Side, { token: string; deep: string; lane: string }> = {
  a: { token: GOLD, deep: "#c98a12", lane: "#f6c25a" },
  b: { token: PURPLE, deep: "#5b3fd9", lane: "#8f6bff" },
};
// The two empty corners
const SPARE = { tr: { lane: "#2bb39f", deep: "#13806f" }, bl: { lane: "#ff7a6b", deep: "#d4473b" } };

/** Where a token sits, in board units (before turning the board for player b) */
function spot(side: Side, p: number, k: number): { x: number; y: number } {
  if (p < 0) {
    const [r0, c0] = YARD[side];
    const [r, c] = NEST[k];
    return { x: (c0 + c) * C, y: (r0 + r) * C };
  }
  if (p === HOME) {
    const dx = side === "a" ? 1 : -1;
    return { x: 7.5 * C + dx * (0.95 * C) + ((k % 2) - 0.5) * 12, y: 7.5 * C + (Math.floor(k / 2) - 0.5) * 14 };
  }
  const [r, c] = p <= 50 ? TRACK[(START[side] + p) % 52] : LANE[side][p - 51];
  return { x: (c + 0.5) * C, y: (r + 0.5) * C };
}

export function Ludo({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  const me: Side = game.me;
  const them = other(me);
  const demo = !!(game.state as { demo?: boolean }).demo;
  const server = game.state as unknown as LudoState;
  // What's been played out on screen (it catches up with the server one move at a time)
  const [st, setSt] = useState<LudoState>(server);
  const [shown, setShown] = useState(server.tokens);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(server.last?.roll ?? 6);
  const [animating, setAnimating] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const { send, note } = useMove(game, act);
  const pops = usePops();
  const stRef = useRef(st);
  stRef.current = st;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const applied = useRef(server.moves);
  // Your own token moves play straight away; the server's copy of the same move is then skipped
  const echo = useRef<number | null>(null);
  const script = useRef([6, 6, 4, 3, 6, 5, 2, 6, 1, 4]);
  const color = (s: Side) => COLORS[s].token;
  const flip = me === "b"; // you're always bottom right
  const view = (pt: { x: number; y: number }) => (flip ? { x: 15 * C - pt.x, y: 15 * C - pt.y } : pt);

  const busy = animating || rolling || waiting;
  const can = st.turn === me && st.roll != null && !busy && game.status === "active" ? legal(st, me) : [];
  const over = won(st, "a") || won(st, "b");

  // The dice tumbles while rolling
  useEffect(() => {
    if (!rolling) return;
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(t);
  }, [rolling]);

  const enqueue = (next: LudoState) => {
    queue.current = queue.current.then(() => playOut(next)).catch(() => {});
  };
  const snap = (next: LudoState) => {
    setSt(next);
    setShown(next.tokens);
    if (next.last?.roll) setFace(next.last.roll);
  };

  /** Show what just happened: a roll, or a token hopping along */
  async function playOut(next: LudoState) {
    const l = next.last;
    if (!l) return snap(next);
    const mine = l.by === me;
    if (l.rolled) {
      setRolling(true);
      await wait(mine ? 250 : 520);
      setRolling(false);
      setFace(l.roll);
      buzz(l.roll === 6 ? [20, 40, 20] : 10);
      sfx("drop");
      if (l.roll === 6 && !l.passed)
        pops.show(mine ? { title: "Six!", sub: "Roll again after you move", tone: "good", art: <DiceArt n={6} /> } : { title: "Six!", sub: `${names.them} rolled a 6`, tone: "move", art: <DiceArt n={6} /> });
      snap(next);
      if (l.passed) await wait(700);
      return;
    }
    const token = l.token!;
    setAnimating(true);
    // Hop along square by square
    const path = l.from! < 0 ? [0] : Array.from({ length: l.to! - l.from! }, (_, i) => l.from! + i + 1);
    for (const p of path) {
      setShown((t) => ({ ...t, [l.by]: t[l.by].map((q, i) => (i === token ? p : q)) }));
      sfx("tick");
      await wait(150);
    }
    if (l.captured?.length) await wait(120);
    setShown(next.tokens);
    setAnimating(false);
    setSt(next);

    const homeCount = next.tokens[l.by].filter((p) => p === HOME).length;
    if (won(next, l.by)) pops.show(
        mine
          ? { title: "Check!", sub: "All 4 home · you won", tone: "win", gift: `Good game. Send ${names.them} a gift` }
          : { title: "So close!", sub: `${names.them} got all 4 home`, tone: "bad", gift: "Say well played with a gift" },
      );
    else if (l.captured?.length)
      pops.show(
        mine
          ? { title: "Captured!", sub: `${names.them}'s token goes home · roll again`, tone: "good", art: <TokenArt color={color(them)} size={86} cross />, gift: "Soften the blow with a gift" }
          : { title: "Sent home!", sub: `${names.them} captured your token`, tone: "bad", art: <TokenArt color={color(me)} size={86} cross />, gift: `Respect. Send ${names.them} a 🔥` },
      );
    else if (l.home)
      pops.show(
        mine ? { title: "Home!", sub: `${homeCount} of 4 home · roll again`, tone: "good", art: <TokenArt color={color(me)} size={86} /> } : { title: "Home!", sub: `${names.them} has ${homeCount} of 4 home`, tone: "move" },
      );
    else if (l.out && mine) pops.show({ title: "You're out!", sub: "A new token joins the race", tone: "good", art: <TokenArt color={color(me)} size={86} /> });
    else if (l.safe && mine) pops.show({ title: "Safe!", sub: "Nobody can capture you on a star", tone: "move" });
  }

  // A real game: play out each new state from the server
  const serverMoves = server.moves;
  useEffect(() => {
    if (demo || serverMoves === applied.current) return;
    const next = game.state as unknown as LudoState;
    const jump = serverMoves !== applied.current + 1;
    applied.current = serverMoves;
    if (echo.current === serverMoves) {
      echo.current = null;
      queue.current = queue.current.then(() => snap(next));
    } else if (jump) queue.current = queue.current.then(() => snap(next));
    else enqueue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMoves, demo]);

  async function roll() {
    if (busy || st.turn !== me || st.roll != null) return;
    sfx("tap");
    if (demo) return enqueue(afterRoll(stRef.current, me, script.current.shift() ?? 1 + Math.floor(Math.random() * 6)));
    setRolling(true);
    setWaiting(true);
    const ok = await send({ type: "roll" });
    setWaiting(false);
    if (!ok) setRolling(false);
  }

  async function move(token: number) {
    if (busy || !can.includes(token)) return;
    let next: LudoState;
    try {
      next = moveToken(stRef.current, me, token);
    } catch {
      return;
    }
    if (demo) return enqueue(next);
    // Play it now; the server checks the same rules
    echo.current = next.moves;
    enqueue(next);
    setWaiting(true);
    const ok = await send({ type: "move", token });
    setWaiting(false);
    if (!ok) {
      echo.current = null;
      queue.current = queue.current.then(() => snap(game.state as unknown as LudoState));
    }
  }

  // Preview: the other player rolls and moves on their own
  useEffect(() => {
    if (!demo || over || st.turn !== them || busy) return;
    const t = setTimeout(
      () => {
        const cur = stRef.current;
        if (cur.roll == null) enqueue(afterRoll(cur, them, script.current.shift() ?? 1 + Math.floor(Math.random() * 6)));
        else enqueue(moveToken(cur, them, pick(cur, them)));
      },
      st.roll == null ? 1100 : 800,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, st, busy]);

  // Preview only: show a pop-up straight away so it can be seen
  const demoPop = (game.state as { demo_pop?: string }).demo_pop;
  useEffect(() => {
    if (!demoPop) return;
    const list: Record<string, Parameters<typeof pops.show>[0]> = {
      six: { title: "Six!", sub: "Roll again after you move", tone: "good", art: <DiceArt n={6} /> },
      capture: { title: "Captured!", sub: `${names.them}'s token goes home · roll again`, tone: "good", art: <TokenArt color={color(them)} size={86} cross /> },
      sent: { title: "Sent home!", sub: `${names.them} captured your token`, tone: "bad", art: <TokenArt color={color(me)} size={86} cross />, gift: `Respect. Send ${names.them} a 🔥` },
      home: { title: "Home!", sub: "2 of 4 home · roll again", tone: "good", art: <TokenArt color={color(me)} size={86} /> },
      win: { title: "Check!", sub: "All 4 home · you won", tone: "win" },
    };
    const show = () => list[demoPop] && pops.show(list[demoPop]);
    const t = setTimeout(show, 600);
    const i = setInterval(show, 3200);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoPop]);

  const home = (s: Side) => st.tokens[s].filter((p) => p === HOME).length;
  const out = (s: Side) => st.tokens[s].filter((p) => p >= 0 && p < HOME).length;
  const sub = (s: Side) => (st.turn === s && !over ? (s === me ? "Your turn" : "Their turn") : `${home(s)} home · ${out(s)} out`);
  const myTurn = st.turn === me && !over;
  const passedMe = st.last?.passed && st.last.by === me;
  const passedThem = st.last?.passed && st.last.by === them;
  const hint = note
    ? note
    : over
      ? won(st, me)
        ? "You won!"
        : `${names.them} won`
      : !myTurn
        ? passedMe
          ? `No move with a ${st.last!.roll}. ${names.them}'s turn`
          : `${names.them} is ${st.roll == null ? "rolling" : "moving"}…`
        : st.roll == null
          ? passedThem
            ? `${names.them} couldn't move. Your roll`
            : "Tap the dice to roll"
          : can.length > 1
            ? "Tap a glowing token to move it"
            : "Tap the glowing token";

  // Tokens drawn on the board, nudged apart when they share a square
  const pieces = useMemo(() => {
    const list = (["b", "a"] as Side[]).flatMap((s) => shown[s].map((p, k) => ({ s, k, p, ...view(spot(s, p, k)) })));
    const seen = new Map<string, number>();
    return list.map((t) => {
      const key = t.p < 0 ? `y${t.s}${t.k}` : `${Math.round(t.x)},${Math.round(t.y)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return { ...t, x: t.x + (t.p >= 0 && t.p < HOME ? n * 7 : 0), y: t.y - (t.p >= 0 && t.p < HOME ? n * 7 : 0) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, flip]);

  const dice = (
    <DiceTray
      face={face}
      rolling={rolling}
      ready={myTurn && st.roll == null && !busy && game.status === "active"}
      onRoll={() => void roll()}
      color={color(st.turn)}
      label={myTurn ? (st.roll == null ? "Your roll" : `You rolled ${st.roll}`) : `${names.them}'s roll`}
    />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col px-3 pt-2 pb-3 lg:flex-row lg:gap-8 lg:px-10 lg:pt-4 lg:pb-8">
      {/* Phones: players along the top */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <Player name="You" color={color(me)} active={myTurn} sub={sub(me)} />
        <div className="font-display text-[22px] font-bold tabular-nums">
          {home(me)}–{home(them)}
        </div>
        <Player right name={names.them} color={color(them)} active={st.turn === them && !over} sub={sub(them)} />
      </div>

      {/* Computers: players and dice beside the board */}
      <aside className="hidden w-[300px] shrink-0 flex-col justify-center gap-3 lg:flex">
        <div className="flex">
          <Player name={names.them} color={color(them)} active={st.turn === them && !over} sub={sub(them)} />
        </div>
        <div className="flex">
          <Player name="You" color={color(me)} active={myTurn} sub={sub(me)} />
        </div>
        <div className="mt-4 grid justify-items-center gap-3 rounded-[28px] bg-white/6 p-6">
          {dice}
          <p className="text-center text-[14px] text-white/75">{hint}</p>
        </div>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-white/45">Roll a 6 to come out · a 6, a capture or a token home rolls again · stars are safe</p>
      </aside>

      {/* The board, as big as the space allows */}
      <div className="relative mt-3 grid min-h-0 flex-1 place-items-center lg:mt-0" style={{ containerType: "size" }}>
        <div
          className="relative rounded-[6%] p-[2.4%]"
          style={{
            width: "min(100cqw, 100cqh)",
            height: "min(100cqw, 100cqh)",
            background: "linear-gradient(145deg, #ffe7a3 0%, #d79a26 30%, #f2b33d 55%, #a8700f 100%)",
            boxShadow: "0 10px 0 #6b4308, 0 30px 70px -20px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -3px 6px rgba(0,0,0,0.35)",
          }}
        >
          <svg viewBox={`0 0 ${15 * C} ${15 * C}`} className="block h-full w-full overflow-visible rounded-[4.5%]" role="img" aria-label="Ludo board">
            <Board flip={flip} />
            {pieces.map((t) => {
              const movable = t.s === me && can.includes(t.k);
              return (
                <g
                  key={`${t.s}${t.k}`}
                  style={{ transform: `translate(${t.x}px, ${t.y}px)`, transition: `transform ${t.p < 0 ? 420 : 140}ms cubic-bezier(.3,1.4,.5,1)` }}
                  // Moves on touch-down: the board redraws while tokens pulse, which can swallow a normal tap
                  onPointerDown={movable ? () => void move(t.k) : undefined}
                  onKeyDown={movable ? (e) => (e.key === "Enter" || e.key === " ") && void move(t.k) : undefined}
                  tabIndex={movable ? 0 : undefined}
                  className={movable ? "cursor-pointer outline-none" : undefined}
                  role={movable ? "button" : undefined}
                  aria-label={movable ? `Move token ${t.k + 1}` : undefined}
                >
                  {movable && <circle r="21" fill="none" stroke="#fff" strokeWidth="3" className="gm-ring" />}
                  <Piece color={COLORS[t.s].token} deep={COLORS[t.s].deep} lift={movable} />
                  {movable && <circle r="24" fill="transparent" />}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Phones: dice at the bottom */}
      <div className="mt-3 flex items-center gap-3 rounded-[24px] bg-white/8 p-3 lg:hidden">
        {dice}
        <p className={clsx("min-w-0 flex-1 text-[14px] font-semibold", myTurn ? "text-white" : "text-white/70")}>{hint}</p>
      </div>

      <GamePop pop={pops.pop} big />
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A glossy token, drawn around (0, 0) */
function Piece({ color, deep, lift }: { color: string; deep: string; lift?: boolean }) {
  const id = color.replace("#", "");
  return (
    <g style={{ transform: lift ? "translateY(-3px)" : undefined, transition: "transform .2s" }}>
      <defs>
        <radialGradient id={`lp-${id}`} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor={color} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="11" rx="14" ry="5" fill="#000" opacity="0.35" />
      <circle r="15.5" fill={deep} />
      <circle r="14" cy="-2" fill={`url(#lp-${id})`} stroke="#fff" strokeWidth="2.5" />
      <rect x="-8" y="-5.5" width="16" height="7" rx="3.5" fill="#fff" opacity="0.92" />
      <ellipse cx="-3.6" cy="-2" rx="1.9" ry="1.6" fill={deep} />
      <ellipse cx="3.6" cy="-2" rx="1.9" ry="1.6" fill={deep} />
      <ellipse cx="-5" cy="-9" rx="4.5" ry="2.4" fill="#fff" opacity="0.55" />
    </g>
  );
}

/** The printed board: four yards, the cross-shaped track, home lanes, stars and the centre */
function Board({ flip }: { flip: boolean }) {
  // Corner colours as you see them: yours bottom right, theirs top left
  const me = flip ? "b" : "a";
  const them = flip ? "a" : "b";
  const corner = { tl: COLORS[them], br: COLORS[me], tr: SPARE.tr, bl: SPARE.bl };
  // Drawn as you see it, so no turning needed (the track and stars look the same either way up)
  const rc = (r: number, c: number): RC => [r, c];
  const cells: React.ReactNode[] = [];
  const laneOf = (r: number, c: number) => {
    const [vr, vc] = rc(r, c);
    if (vr === 7 && vc >= 1 && vc <= 5) return corner.tl.lane;
    if (vc === 7 && vr >= 1 && vr <= 5) return corner.tr.lane;
    if (vr === 7 && vc >= 9 && vc <= 13) return corner.br.lane;
    if (vc === 7 && vr >= 9 && vr <= 13) return corner.bl.lane;
    if (vr === 6 && vc === 1) return corner.tl.lane;
    if (vr === 1 && vc === 8) return corner.tr.lane;
    if (vr === 8 && vc === 13) return corner.br.lane;
    if (vr === 13 && vc === 6) return corner.bl.lane;
    return null;
  };
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++) {
      const arm = (r >= 6 && r <= 8 && (c < 6 || c > 8)) || (c >= 6 && c <= 8 && (r < 6 || r > 8));
      if (!arm) continue;
      const fill = laneOf(r, c);
      cells.push(<rect key={`${r}-${c}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2} rx="6" fill={fill ?? "url(#lb-cell)"} stroke={fill ? "rgba(0,0,0,0.12)" : "#e6d8bd"} />);
    }
  const star = (r: number, c: number, key: string) => {
    const cx = c * C + C / 2;
    const cy = r * C + C / 2;
    const d = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 5.5 : 12;
      return `${i ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }).join("");
    return <path key={key} d={d + "Z"} fill="#1a1035" opacity="0.2" />;
  };
  const yard = (x: number, y: number, col: { lane: string; deep: string }, spare: boolean, key: string) => (
    <g key={key} opacity={spare ? 0.72 : 1}>
      <rect x={x + 2} y={y + 2} width={6 * C - 4} height={6 * C - 4} rx="22" fill={col.deep} />
      <rect x={x + 2} y={y} width={6 * C - 4} height={6 * C - 6} rx="22" fill={col.lane} />
      <rect x={x + 2} y={y} width={6 * C - 4} height={6 * C - 6} rx="22" fill="url(#lb-sheen)" />
      <rect x={x + C * 0.8} y={y + C * 0.8} width={4.4 * C} height={4.4 * C} rx="26" fill="#fffaf0" stroke="rgba(0,0,0,0.08)" />
      {NEST.map(([r, c], i) => (
        <g key={i}>
          <circle cx={x + c * C} cy={y + r * C} r="19" fill={col.lane} opacity="0.28" />
          <circle cx={x + c * C} cy={y + r * C} r="15" fill="none" stroke={col.deep} strokeWidth="2" opacity="0.4" />
        </g>
      ))}
    </g>
  );
  const m = 7.5 * C;
  const tri = (pts: string, fill: string, key: string) => <path key={key} d={pts} fill={fill} stroke="rgba(0,0,0,0.12)" />;
  return (
    <g>
      <defs>
        <linearGradient id="lb-cell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f4ecdc" />
        </linearGradient>
        <linearGradient id="lb-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect width={15 * C} height={15 * C} fill="#fbf3e2" />
      {yard(0, 0, corner.tl, false, "tl")}
      {yard(9 * C, 0, corner.tr, true, "tr")}
      {yard(0, 9 * C, corner.bl, true, "bl")}
      {yard(9 * C, 9 * C, corner.br, false, "br")}
      {cells}
      {/* Safe squares: the four stars (start squares are safe too) */}
      {SAFE.filter((i) => i % 13 !== 0).map((i) => {
        const [r, c] = rc(...TRACK[i]);
        return star(r, c, `s${i}`);
      })}
      {/* Start arrows */}
      {[0, 13, 26, 39].map((i) => {
        const [r, c] = rc(...TRACK[i]);
        return <circle key={`st${i}`} cx={c * C + C / 2} cy={r * C + C / 2} r="6" fill="#fff" opacity="0.85" />;
      })}
      {/* Home: four triangles meeting in the middle */}
      {tri(`M${6 * C} ${6 * C}L${6 * C} ${9 * C}L${m} ${m}Z`, corner.tl.lane, "t1")}
      {tri(`M${6 * C} ${6 * C}L${9 * C} ${6 * C}L${m} ${m}Z`, corner.tr.lane, "t2")}
      {tri(`M${9 * C} ${6 * C}L${9 * C} ${9 * C}L${m} ${m}Z`, corner.br.lane, "t3")}
      {tri(`M${6 * C} ${9 * C}L${9 * C} ${9 * C}L${m} ${m}Z`, corner.bl.lane, "t4")}
      <rect x={6 * C} y={6 * C} width={3 * C} height={3 * C} fill="url(#lb-sheen)" />
      <circle cx={m} cy={m} r="25" fill="#1a1035" stroke="#f2b33d" strokeWidth="4" />
      <rect x={m - 14} y={m - 6} width="28" height="12" rx="6" fill="#fff" />
      <ellipse cx={m - 6} cy={m} rx="3" ry="2.6" fill="#1a1035" />
      <ellipse cx={m + 6} cy={m} rx="3" ry="2.6" fill="#1a1035" />
    </g>
  );
}
