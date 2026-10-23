/**
 * Gem Clash: a match-3 duel on one shared board. Players take turns; each turn
 * is 2 swaps. Swap two neighbouring gems to line up 3 or more of a colour.
 * Every gem you clear scores, and cascades score more each time.
 *   Match 4 in a line: a striped gem (clears its row or column when matched).
 *   Match in an L or T: a bomb gem (clears the 3×3 around it).
 *   Match 5 in a line: a star (swap it with any gem to clear every gem of that colour).
 * Making a special gem earns an extra swap. After 5 turns each, the most points wins.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const SIZE = 7;
export const N = SIZE * SIZE;
export const COLORS = ["r", "y", "g", "b", "p"] as const;
export const TURNS = 5;
export const SWAPS = 2;
export const STAR = "*";

export type Step = {
  /** Cells that popped */
  clear: number[];
  /** The board after gems fell and new ones dropped in */
  board: string[];
  /** How many rows each gem fell to get where it is now */
  drop: number[];
  points: number;
};

export type GemsState = {
  board: string[];
  turn: Side;
  /** Swaps left this turn */
  left: number;
  /** Turns each player has finished */
  done: Record<Side, number>;
  points: Record<Side, number>;
  last: { by: Side; swap: [number, number]; before: string[]; steps: Step[]; gained: number; extra: boolean; shuffled?: boolean } | null;
  moves: number;
};
export type GemsMove = { type: "swap"; a: number; b: number } | { type: "shuffle" };

type Rng = () => number;

export const colorOf = (g: string | null | undefined) => (g && g !== STAR ? g[0] : null);
export const kindOf = (g: string | null | undefined): "plain" | "h" | "v" | "x" | "star" =>
  !g ? "plain" : g === STAR ? "star" : g.length > 1 ? (g[1] as "h" | "v" | "x") : "plain";

const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;
export const adjacent = (a: number, b: number) => {
  const [r1, c1] = rc(a);
  const [r2, c2] = rc(b);
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
};
const randomColor = (rng: Rng) => COLORS[Math.floor(rng() * COLORS.length)];

type Run = { cells: number[]; dir: "h" | "v" };
type Group = { cells: number[]; runs: Run[] };

/** Every line of 3 or more, joined into groups where lines share a gem */
function findGroups(board: (string | null)[]): Group[] {
  const runs: Run[] = [];
  const scan = (dir: "h" | "v") => {
    for (let x = 0; x < SIZE; x++) {
      let run: number[] = [];
      let col: string | null = null;
      for (let y = 0; y <= SIZE; y++) {
        const i = y < SIZE ? (dir === "h" ? x * SIZE + y : y * SIZE + x) : -1;
        const c = i >= 0 ? colorOf(board[i]) : null;
        if (c && c === col) run.push(i);
        else {
          if (run.length >= 3) runs.push({ cells: run, dir });
          run = c ? [i] : [];
          col = c;
        }
      }
    }
  };
  scan("h");
  scan("v");
  // Join lines that share a cell (an L or a T)
  const groups: Group[] = [];
  for (const run of runs) {
    const hits = groups.filter((g) => g.cells.some((c) => run.cells.includes(c)));
    const merged: Group = { cells: [...run.cells], runs: [run] };
    for (const g of hits) {
      merged.cells.push(...g.cells);
      merged.runs.push(...g.runs);
      groups.splice(groups.indexOf(g), 1);
    }
    merged.cells = [...new Set(merged.cells)];
    groups.push(merged);
  }
  return groups;
}

/** The special gem a group makes, if any */
function specialFor(g: Group, color: string): string | null {
  const longest = Math.max(...g.runs.map((r) => r.cells.length));
  if (longest >= 5) return STAR;
  const dirs = new Set(g.runs.map((r) => r.dir));
  if (dirs.size > 1) return color + "x";
  if (longest === 4) return color + (g.runs[0].dir === "h" ? "v" : "h");
  return null;
}

/** What a special gem clears when it goes off */
function blast(board: (string | null)[], i: number, rng: Rng): number[] {
  const g = board[i];
  const [r, c] = rc(i);
  const k = kindOf(g);
  if (k === "h") return Array.from({ length: SIZE }, (_, x) => r * SIZE + x);
  if (k === "v") return Array.from({ length: SIZE }, (_, y) => y * SIZE + c);
  if (k === "x") {
    const out: number[] = [];
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) out.push(y * SIZE + x);
    return out;
  }
  if (k === "star") {
    // Set off by another blast: takes the most common colour
    const count: Record<string, number> = {};
    for (const b of board) {
      const col = colorOf(b);
      if (col) count[col] = (count[col] ?? 0) + 1;
    }
    const top = Object.keys(count).sort((x, y) => count[y] - count[x] || (rng() < 0.5 ? -1 : 1))[0];
    return board.flatMap((b, j) => (colorOf(b) === top ? [j] : []));
  }
  return [];
}

/** Clear these cells, setting off any special gems among them */
function explode(board: (string | null)[], start: Iterable<number>, rng: Rng, keep: Set<number> = new Set()) {
  const out = new Set<number>();
  const queue = [...start];
  while (queue.length) {
    const i = queue.shift()!;
    if (out.has(i) || !board[i]) continue;
    out.add(i);
    if (kindOf(board[i]) !== "plain") for (const j of blast(board, i, rng)) if (!out.has(j)) queue.push(j);
  }
  for (const k of keep) out.delete(k);
  return out;
}

/** Gems fall into the gaps and new ones drop in from the top */
function fall(board: (string | null)[], rng: Rng) {
  const next: string[] = new Array(N);
  const drop: number[] = new Array(N).fill(0);
  for (let c = 0; c < SIZE; c++) {
    let to = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const g = board[r * SIZE + c];
      if (g) {
        next[to * SIZE + c] = g;
        drop[to * SIZE + c] = to - r;
        to--;
      }
    }
    const holes = to + 1;
    for (let r = to; r >= 0; r--) {
      next[r * SIZE + c] = randomColor(rng);
      drop[r * SIZE + c] = holes;
    }
  }
  return { board: next, drop };
}

/** Would swapping these two make something happen? */
export function swapWorks(board: string[], a: number, b: number) {
  if (a === b || a < 0 || b < 0 || a >= N || b >= N || !adjacent(a, b)) return false;
  if (board[a] === STAR || board[b] === STAR) return true;
  const t = [...board];
  [t[a], t[b]] = [t[b], t[a]];
  return findGroups(t).some((g) => g.cells.includes(a) || g.cells.includes(b));
}

/** Any swap at all that works? */
export function hasMove(board: string[]) {
  for (let i = 0; i < N; i++) {
    if (i % SIZE < SIZE - 1 && swapWorks(board, i, i + 1)) return true;
    if (i + SIZE < N && swapWorks(board, i, i + SIZE)) return true;
  }
  return false;
}

/** A fresh board with nothing lined up, and at least one move */
export function freshBoard(rng: Rng = Math.random): string[] {
  for (;;) {
    const b: string[] = [];
    for (let i = 0; i < N; i++) {
      const [r, c] = rc(i);
      let col: string;
      do col = randomColor(rng);
      while ((c >= 2 && b[i - 1] === col && b[i - 2] === col) || (r >= 2 && b[i - SIZE] === col && b[i - 2 * SIZE] === col));
      b.push(col);
    }
    if (hasMove(b)) return b;
  }
}

/** Play a swap out: every pop, fall and cascade */
export function resolve(board: string[], a: number, b: number, rng: Rng = Math.random) {
  let cur: (string | null)[] = [...board];
  [cur[a], cur[b]] = [cur[b], cur[a]];
  const before = [...cur] as string[];
  const steps: Step[] = [];
  let made = false;

  // A star swapped with a gem clears that colour (two stars clear everything)
  let forced: Set<number> | null = null;
  if (board[a] === STAR || board[b] === STAR) {
    const starAt = board[a] === STAR ? b : a; // after the swap
    const otherAt = starAt === a ? b : a;
    const col = colorOf(cur[otherAt]);
    const start = cur[otherAt] === STAR ? cur.map((_, i) => i) : [starAt, ...cur.flatMap((g, i) => (colorOf(g) === col ? [i] : []))];
    // The star itself is spent: clear it without setting it off again
    cur[starAt] = "_";
    forced = explode(cur, start, rng);
    forced.add(starAt);
  }

  for (let n = 0; n < 40; n++) {
    let clear: Set<number>;
    const place: [number, string][] = [];
    if (forced) {
      clear = forced;
      forced = null;
    } else {
      const groups = findGroups(cur);
      if (!groups.length) break;
      const raw = new Set<number>();
      for (const g of groups) {
        g.cells.forEach((c) => raw.add(c));
        const sp = specialFor(g, colorOf(cur[g.cells[0]])!);
        if (sp) {
          // On the first pop it appears where you swapped; later, in the middle
          const at = n === 0 && g.cells.includes(b) ? b : n === 0 && g.cells.includes(a) ? a : g.cells[Math.floor(g.cells.length / 2)];
          place.push([at, sp]);
        }
      }
      clear = explode(cur, raw, rng, new Set(place.map(([i]) => i)));
      // A special that was in the match still goes off
      for (const [i] of place) if (kindOf(cur[i]) !== "plain") for (const j of explode(cur, blast(cur, i, rng), rng)) if (j !== i) clear.add(j);
    }
    const points = clear.size * 10 * Math.min(n + 1, 5) + place.length * 30;
    for (const i of clear) cur[i] = null;
    for (const [i, sp] of place) {
      cur[i] = sp;
      made = true;
    }
    const f = fall(cur, rng);
    steps.push({ clear: [...clear].sort((x, y) => x - y), board: [...f.board], drop: f.drop, points });
    cur = f.board;
  }
  return { before, steps, board: cur as string[], made };
}

export function applyMove(st: GemsState, side: Side, mv: GemsMove, rng: Rng = Math.random): MoveResult<GemsState> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");

  if (mv.type === "shuffle") {
    if (hasMove(st.board)) throw new MoveError("There's still a move. Look again!");
    const board = freshBoard(rng);
    return { state: { ...st, board, last: { by: side, swap: [0, 0], before: board, steps: [], gained: 0, extra: false, shuffled: true }, moves: st.moves + 1 } };
  }

  const a = Number(mv.a);
  const b = Number(mv.b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || !adjacent(a, b)) throw new MoveError("Swap two gems side by side");
  if (!swapWorks(st.board, a, b)) throw new MoveError("No match there");

  const r = resolve(st.board, a, b, rng);
  let board = r.board;
  let shuffled = false;
  if (!hasMove(board)) {
    board = freshBoard(rng);
    shuffled = true;
  }
  const gained = r.steps.reduce((n, s) => n + s.points, 0);
  const points = { ...st.points, [side]: st.points[side] + gained };
  let left = st.left - 1 + (r.made ? 1 : 0);
  let turn = st.turn;
  const done = { ...st.done };
  if (left <= 0) {
    done[side] += 1;
    turn = other(side);
    left = SWAPS;
  }
  const next: GemsState = {
    board,
    turn,
    left,
    done,
    points,
    last: { by: side, swap: [a, b], before: r.before, steps: r.steps, gained, extra: r.made, ...(shuffled ? { shuffled } : {}) },
    moves: st.moves + 1,
  };
  if (done.a >= TURNS && done.b >= TURNS) {
    const winner: Side | null = points.a > points.b ? "a" : points.b > points.a ? "b" : null;
    return { state: next, over: { winner, score_a: points.a, score_b: points.b } };
  }
  return { state: next };
}
