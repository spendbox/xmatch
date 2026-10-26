"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { LADDERS, roll as applyRoll, SNAKES, type SnakesState } from "@/lib/boardgames/snakes";
import { other, type Side } from "@/lib/boardgames/types";
import { GOLD, PURPLE, Player, type Names } from "./parts";
import { DiceArt, GamePop, usePops, type Pop } from "./GamePop";
import { DiceTray } from "./BoardBits";
import { useMove } from "./useMove";

const C = 60; // one square in board units (10 × 10)
type Pt = { x: number; y: number };

/** The centre of square n (1–100), snaking up from the bottom left */
function at(n: number): Pt {
  const i = Math.max(1, n) - 1;
  const row = Math.floor(i / 10);
  const col = row % 2 ? 9 - (i % 10) : i % 10;
  return { x: col * C + C / 2, y: (9 - row) * C + C / 2 };
}

/** Points along a snake from its head (top) to its tail (bottom) */
function snakeLine(head: number, tail: number, steps = 40): Pt[] {
  const a = at(head);
  const b = at(tail);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const amp = Math.min(70, len * 0.32) * (head % 2 ? 1 : -1);
  const p1 = { x: a.x + dx / 3 + nx * amp, y: a.y + dy / 3 + ny * amp };
  const p2 = { x: a.x + (2 * dx) / 3 - nx * amp, y: a.y + (2 * dy) / 3 - ny * amp };
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps;
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
    };
  });
}

const COLORS: Record<Side, { token: string; deep: string }> = { a: { token: GOLD, deep: "#c98a12" }, b: { token: PURPLE, deep: "#5b3fd9" } };
const SNAKE_SKINS = [
  { body: "#1fa36f", deep: "#0b5a3c", spot: "#c6f28a" },
  { body: "#ff5a6e", deep: "#a3142d", spot: "#ffd36b" },
  { body: "#7c5cf0", deep: "#3a1f9a", spot: "#7dffd8" },
];

export function SnakesLadders({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  const me: Side = game.me;
  const them = other(me);
  const demo = !!(game.state as { demo?: boolean }).demo;
  const server = game.state as unknown as SnakesState;
  // What's been played out on screen (it catches up with the server one roll at a time)
  const [st, setSt] = useState<SnakesState>(server);
  const [shown, setShown] = useState<Record<Side, Pt>>(() => ({ a: at(server.pos.a), b: at(server.pos.b) }));
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [face, setFace] = useState(server.last?.roll ?? 3);
  const { send, note } = useMove(game, act);
  const pops = usePops();
  const stRef = useRef(st);
  stRef.current = st;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const applied = useRef(server.moves);
  const script = useRef([4, 3, 6, 2, 5, 1, 4]);
  const color = (s: Side) => COLORS[s].token;
  const over = st.pos.a === 100 || st.pos.b === 100;
  const myTurn = st.turn === me && !over;
  const busy = rolling || moving || waiting;

  // The dice tumbles while rolling
  useEffect(() => {
    if (!rolling) return;
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(t);
  }, [rolling]);

  const snap = (next: SnakesState) => {
    setSt(next);
    setShown({ a: at(next.pos.a), b: at(next.pos.b) });
    if (next.last?.roll) setFace(next.last.roll);
  };
  const enqueue = (next: SnakesState) => {
    queue.current = queue.current.then(() => playOut(next)).catch(() => {});
  };

  /** Show a roll: the dice lands, the token hops, then climbs or slides */
  async function playOut(next: SnakesState) {
    const l = next.last;
    if (!l) return snap(next);
    const side = l.by;
    const mine = side === me;
    setRolling(true);
    await wait(mine ? 250 : 520);
    setRolling(false);
    setFace(l.roll);
    buzz(10);
    setMoving(true);
    for (let p = l.from + 1; p <= l.landed; p++) {
      setShown((s) => ({ ...s, [side]: at(p) }));
      sfx("tick");
      await wait(140);
    }
    if (l.ladder || l.snake) {
      await wait(200);
      const line = l.ladder ? Array.from({ length: 11 }, (_, k) => lerp(at(l.landed), at(l.to), k / 10)) : snakeLine(l.landed, l.to, 18);
      for (const pt of line) {
        setShown((s) => ({ ...s, [side]: pt }));
        await wait(l.ladder ? 55 : 50);
      }
    }
    setMoving(false);
    snap(next);

    let p: Omit<Pop, "id"> | null = null;
    if (l.to === 100)
      p = mine
        ? { title: "100!", sub: `You won · ${names.them} was on ${next.pos[them]}`, tone: "win", gift: `Good game. Send ${names.them} a gift` }
        : { title: "So close!", sub: `${names.them} reached 100 first`, tone: "bad", gift: "Say well played with a gift" };
    else if (l.ladder)
      p = mine
        ? { title: l.to - l.landed >= 20 ? "Huge climb!" : "Up the ladder!", sub: `${l.landed} → ${l.to}`, tone: "good", art: <LadderArt /> }
        : { title: "Big climb", sub: `${names.them} climbed ${l.landed} → ${l.to}`, tone: "move", art: <LadderArt /> };
    else if (l.snake)
      p = mine ? { title: "Snake bite!", sub: `${l.landed} → ${l.to}`, tone: "bad", art: <SnakeArt /> } : { title: "Ouch!", sub: `${names.them} slid ${l.landed} → ${l.to}`, tone: "good", art: <SnakeArt /> };
    else if (l.roll === 6 && mine) p = { title: "Six!", sub: "Roll again", tone: "good", art: <DiceArt n={6} /> };
    else if (mine && l.to >= 94) p = { title: "So close!", sub: `Square ${l.to} · ${100 - l.to} to win`, tone: "move" };
    if (p) pops.show(p);
  }

  // A real game: play out each new roll from the server
  const serverMoves = server.moves;
  useEffect(() => {
    if (demo || serverMoves === applied.current) return;
    const next = game.state as unknown as SnakesState;
    const jump = serverMoves !== applied.current + 1;
    applied.current = serverMoves;
    if (jump) queue.current = queue.current.then(() => snap(next));
    else enqueue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMoves, demo]);

  async function turn() {
    if (busy || stRef.current.turn !== me || over) return;
    sfx("tap");
    if (demo) return enqueue(applyRoll(stRef.current, me, script.current.shift() ?? 1 + Math.floor(Math.random() * 6)));
    setRolling(true);
    setWaiting(true);
    const ok = await send({ type: "roll" });
    setWaiting(false);
    if (!ok) setRolling(false);
  }

  // Preview: the other player takes their turn on their own
  useEffect(() => {
    if (!demo || over || st.turn !== them || busy) return;
    const t = setTimeout(() => enqueue(applyRoll(stRef.current, them, 1 + Math.floor(Math.random() * 6))), 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, st, busy]);

  // Preview only: show a pop-up straight away so it can be seen
  const demoPop = (game.state as { demo_pop?: string }).demo_pop;
  useEffect(() => {
    if (!demoPop) return;
    const list: Record<string, Omit<Pop, "id">> = {
      ladder: { title: "Huge climb!", sub: "4 → 25", tone: "good", art: <LadderArt /> },
      snake: { title: "Snake bite!", sub: "66 → 45", tone: "bad", art: <SnakeArt /> },
      close: { title: "So close!", sub: "Square 96 · 4 to win", tone: "move" },
      win: { title: "100!", sub: `You won · ${names.them} was on 88`, tone: "win" },
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

  const sub = (s: Side) => (st.turn === s && !over ? (s === me ? "Your turn" : "Their turn") : `Square ${st.pos[s] || "start"}`);
  const hint = note
    ? note
    : over
    ? st.pos[me] === 100
      ? "You won!"
      : `${names.them} won`
    : !myTurn
      ? `${names.them} is rolling…`
      : moving || rolling
        ? "…"
        : st.pos[me] >= 94
          ? `You need exactly ${100 - st.pos[me]} to win`
          : "Tap the dice to roll";

  // Two tokens on one square sit side by side
  const same = Math.hypot(shown.a.x - shown.b.x, shown.a.y - shown.b.y) < 10;
  const dice = (
    <DiceTray face={face} rolling={rolling} ready={myTurn && !busy && game.status === "active"} onRoll={() => void turn()} color={color(st.turn)} label={myTurn ? "Your roll" : `${names.them}'s roll`} />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col px-3 pt-2 pb-3 lg:flex-row lg:gap-8 lg:px-10 lg:pt-4 lg:pb-8">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Player name="You" photo={names.mePhoto} color={color(me)} active={myTurn} sub={sub(me)} />
        <div className="font-display text-[20px] font-bold tabular-nums">{st.pos[me]}</div>
        <Player right name={names.them} photo={names.themPhoto} onClick={names.onThem} color={color(them)} active={st.turn === them && !over} sub={sub(them)} />
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col justify-center gap-3 lg:flex">
        <div className="flex">
          <Player name={names.them} photo={names.themPhoto} onClick={names.onThem} color={color(them)} active={st.turn === them && !over} sub={sub(them)} />
        </div>
        <div className="flex">
          <Player name="You" photo={names.mePhoto} color={color(me)} active={myTurn} sub={sub(me)} />
        </div>
        <div className="mt-4 grid justify-items-center gap-3 rounded-[28px] bg-white/6 p-6">
          {dice}
          <p className="text-center text-[14px] text-white/75">{hint}</p>
        </div>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-white/45">Race to 100 · ladders lift you, snakes drop you · a 6 rolls again · land on 100 exactly</p>
      </aside>

      <div className="relative mt-3 grid min-h-0 flex-1 place-items-center lg:mt-0" style={{ containerType: "size" }}>
        <div
          className="relative rounded-[5%] p-[2.2%]"
          style={{
            width: "min(100cqw, 100cqh)",
            height: "min(100cqw, 100cqh)",
            background: "linear-gradient(145deg, #ffe7a3 0%, #d79a26 30%, #f2b33d 55%, #a8700f 100%)",
            boxShadow: "0 10px 0 #6b4308, 0 30px 70px -20px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -3px 6px rgba(0,0,0,0.35)",
          }}
        >
          <svg viewBox={`0 0 ${10 * C} ${10 * C}`} className="block h-full w-full overflow-visible rounded-[3.5%]" role="img" aria-label="Snakes and Ladders board">
            <Board />
            {(["b", "a"] as Side[]).map((s) => {
              const pt = shown[s];
              const dx = same ? (s === me ? 11 : -11) : 0;
              return (
                <g key={s} style={{ transform: `translate(${pt.x + dx}px, ${pt.y}px)`, transition: "transform 120ms cubic-bezier(.3,1.4,.5,1)" }}>
                  <Piece color={COLORS[s].token} deep={COLORS[s].deep} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-[24px] bg-white/8 p-3 lg:hidden">
        {dice}
        <p className={clsx("min-w-0 flex-1 text-[14px] font-semibold", myTurn ? "text-white" : "text-white/70")}>{hint}</p>
      </div>

      <GamePop pop={pops.pop} big />
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function Piece({ color, deep }: { color: string; deep: string }) {
  const id = color.replace("#", "");
  return (
    <g>
      <defs>
        <radialGradient id={`sp-${id}`} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor={color} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="15" rx="18" ry="6" fill="#000" opacity="0.4" />
      <circle r="20" fill={deep} />
      <circle r="18.5" cy="-2.5" fill={`url(#sp-${id})`} stroke="#fff" strokeWidth="3" />
      <rect x="-10.5" y="-7.5" width="21" height="9" rx="4.5" fill="#fff" opacity="0.92" />
      <ellipse cx="-4.6" cy="-3" rx="2.4" ry="2" fill={deep} />
      <ellipse cx="4.6" cy="-3" rx="2.4" ry="2" fill={deep} />
      <ellipse cx="-6.5" cy="-12" rx="6" ry="3" fill="#fff" opacity="0.55" />
    </g>
  );
}

/** Squares, numbers, ladders and snakes */
function Board() {
  const tiles = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let n = 1; n <= 100; n++) {
      const { x, y } = at(n);
      const row = Math.floor((n - 1) / 10);
      const hue = 168 + row * 19;
      const light = (n + row) % 2 ? 90 : 82;
      out.push(
        <g key={n}>
          <rect x={x - C / 2} y={y - C / 2} width={C} height={C} fill={`hsl(${hue} 70% ${light}%)`} />
          <rect x={x - C / 2 + 2} y={y - C / 2 + 2} width={C - 4} height={C - 4} rx="7" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
          <text x={x - C / 2 + 6} y={y - C / 2 + 15} fontSize="12.5" fontWeight="800" fill={`hsl(${hue} 45% 28%)`} fillOpacity="0.75" fontFamily="var(--font-sans), system-ui">
            {n}
          </text>
        </g>,
      );
    }
    return out;
  }, []);
  const finish = at(100);
  return (
    <g>
      {tiles}
      {/* 100: the crown */}
      <rect x={finish.x - C / 2 + 2} y={finish.y - C / 2 + 2} width={C - 4} height={C - 4} rx="8" fill="#f2b33d" stroke="#fff" strokeWidth="2" />
      <path d={`M${finish.x - 15} ${finish.y + 10}l-3-18 10 8 8-13 8 13 10-8-3 18z`} fill="#fff" stroke="#a26b00" strokeWidth="2" strokeLinejoin="round" />
      <text x={finish.x - C / 2 + 6} y={finish.y - C / 2 + 15} fontSize="12.5" fontWeight="900" fill="#5a3200">
        100
      </text>
      {Object.entries(LADDERS).map(([a, b]) => (
        <Ladder key={a} from={at(+a)} to={at(b)} />
      ))}
      {Object.entries(SNAKES).map(([h, t], i) => (
        <Snake key={h} pts={snakeLine(+h, t)} skin={SNAKE_SKINS[i % SNAKE_SKINS.length]} />
      ))}
    </g>
  );
}

function Ladder({ from, to }: { from: Pt; to: Pt }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 11;
  const ny = (dx / len) * 11;
  const rungs = Math.floor(len / 22);
  const rail = (s: number, k: string) => (
    <g key={k}>
      <line x1={from.x + nx * s} y1={from.y + ny * s} x2={to.x + nx * s} y2={to.y + ny * s} stroke="#6b3f0c" strokeWidth="8" strokeLinecap="round" />
      <line x1={from.x + nx * s} y1={from.y + ny * s} x2={to.x + nx * s} y2={to.y + ny * s} stroke="#d08b2e" strokeWidth="5" strokeLinecap="round" />
      <line x1={from.x + nx * s - 1} y1={from.y + ny * s - 1} x2={to.x + nx * s - 1} y2={to.y + ny * s - 1} stroke="#ffd28a" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </g>
  );
  return (
    <g>
      <line x1={from.x + 4} y1={from.y + 6} x2={to.x + 4} y2={to.y + 6} stroke="#000" strokeOpacity="0.22" strokeWidth="30" strokeLinecap="round" />
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs;
        const cx = from.x + dx * t;
        const cy = from.y + dy * t;
        return (
          <g key={i}>
            <line x1={cx + nx} y1={cy + ny} x2={cx - nx} y2={cy - ny} stroke="#6b3f0c" strokeWidth="6" strokeLinecap="round" />
            <line x1={cx + nx} y1={cy + ny} x2={cx - nx} y2={cy - ny} stroke="#e8a443" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        );
      })}
      {rail(1, "l")}
      {rail(-1, "r")}
    </g>
  );
}

function Snake({ pts, skin }: { pts: Pt[]; skin: { body: string; deep: string; spot: string } }) {
  // A body that tapers from the head to the tail
  const n = pts.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const w = 12 * (1 - i / n) + 2.5 * (i / n);
    left.push({ x: p.x - (dy / l) * w, y: p.y + (dx / l) * w });
    right.push({ x: p.x + (dy / l) * w, y: p.y - (dx / l) * w });
  });
  const d = "M" + [...left, ...right.reverse()].map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L") + "Z";
  const head = pts[0];
  const nxt = pts[2];
  const ang = (Math.atan2(head.y - nxt.y, head.x - nxt.x) * 180) / Math.PI;
  const id = skin.body.slice(1);
  return (
    <g>
      <defs>
        <linearGradient id={`sk-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={skin.body} />
          <stop offset="1" stopColor={skin.deep} />
        </linearGradient>
      </defs>
      <path d={d} fill="#000" opacity="0.25" transform="translate(4 6)" />
      <path d={d} fill={`url(#sk-${id})`} stroke={skin.deep} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) =>
        i > 3 && i < n - 2 && i % 3 === 0 ? <circle key={i} cx={p.x} cy={p.y} r={Math.max(1.5, 5.5 * (1 - i / n))} fill={skin.spot} opacity="0.85" /> : null,
      )}
      <g transform={`translate(${head.x} ${head.y}) rotate(${ang})`}>
        <path d="M14 0 l9 -4 M14 0 l9 4" stroke="#e5484d" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="2" cy="0" rx="17" ry="13" fill={skin.deep} />
        <ellipse cx="2" cy="-1" rx="16" ry="12" fill={skin.body} />
        <circle cx="6" cy="-6" r="4.5" fill="#fff" />
        <circle cx="6" cy="6" r="4.5" fill="#fff" />
        <circle cx="7.5" cy="-6" r="2.3" fill="#111" />
        <circle cx="7.5" cy="6" r="2.3" fill="#111" />
      </g>
    </g>
  );
}

/** Pop-up art */
export function LadderArt() {
  return (
    <svg width="92" height="110" viewBox="0 0 92 110" aria-hidden>
      <g transform="rotate(12 46 55)">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="22" y={14 + i * 20} width="48" height="8" rx="4" fill="#e8a443" stroke="#6b3f0c" strokeWidth="2.5" />
        ))}
        <rect x="14" y="2" width="11" height="106" rx="5.5" fill="#d08b2e" stroke="#6b3f0c" strokeWidth="3" />
        <rect x="67" y="2" width="11" height="106" rx="5.5" fill="#d08b2e" stroke="#6b3f0c" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function SnakeArt() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden>
      <path d="M10 80c20-30 40 20 60-10s30-30 34-46" fill="none" stroke="#0b5a3c" strokeWidth="20" strokeLinecap="round" />
      <path d="M10 80c20-30 40 20 60-10s30-30 34-46" fill="none" stroke="#1fa36f" strokeWidth="15" strokeLinecap="round" />
      <path d="M10 80c20-30 40 20 60-10s30-30 34-46" fill="none" stroke="#c6f28a" strokeWidth="4" strokeDasharray="3 11" strokeLinecap="round" />
      <ellipse cx="104" cy="22" rx="16" ry="13" fill="#0b5a3c" />
      <ellipse cx="104" cy="21" rx="15" ry="12" fill="#1fa36f" />
      <circle cx="99" cy="16" r="5" fill="#fff" />
      <circle cx="110" cy="16" r="5" fill="#fff" />
      <circle cx="100" cy="17" r="2.5" fill="#111" />
      <circle cx="111" cy="17" r="2.5" fill="#111" />
      <path d="M104 34v8m0 0-4 5m4-5 4 5" stroke="#e5484d" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
