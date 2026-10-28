/**
 * Ayo (Ayoayo / Ayo Olopon): 12 pits, 4 seeds each, 48 seeds.
 * Pits 0–5 are player a's (bottom row, left to right), 6–11 are player b's
 * (top row, right to left), so sowing goes anticlockwise by counting up.
 *
 * Pick up every seed in one of your pits and sow one into each pit after it
 * (skipping the pit you emptied). If your last seed makes a pit on their side
 * hold 2 or 3, you capture it, and the pits just before it on their side that
 * also hold 2 or 3. A capture that would take all their seeds takes nothing.
 * If they have no seeds, you must give them some if you can.
 * First to 25 wins. If nobody can move, each player keeps the seeds on their side.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export type AyoState = {
  pits: number[];
  store: { a: number; b: number };
  turn: Side;
  last: { pit: number; end: number; captured: number[] } | null;
  moves: number;
};

export const WIN = 25;
export const MAX_MOVES = 300;

export const startPits = () => Array.from({ length: 12 }, () => 4);
export const mine = (side: Side, pit: number) => (side === "a" ? pit < 6 : pit >= 6);
const sideSeeds = (pits: number[], side: Side) => pits.reduce((n, v, i) => n + (mine(side, i) ? v : 0), 0);

function sow(pits: number[], from: number) {
  const p = [...pits];
  let seeds = p[from];
  p[from] = 0;
  let i = from;
  while (seeds > 0) {
    i = (i + 1) % 12;
    if (i === from) continue;
    p[i] += 1;
    seeds -= 1;
  }
  return { pits: p, end: i };
}

function play(pits: number[], side: Side, from: number) {
  const s = sow(pits, from);
  const p = s.pits;
  const captured: number[] = [];
  let i = s.end;
  while (!mine(side, i) && (p[i] === 2 || p[i] === 3)) {
    captured.push(i);
    i = (i + 11) % 12;
  }
  const taken = captured.reduce((n, k) => n + p[k], 0);
  // Taking every one of their seeds isn't allowed: the move captures nothing
  if (taken > 0 && taken === sideSeeds(p, other(side))) return { pits: p, end: s.end, captured: [] as number[], taken: 0 };
  for (const k of captured) p[k] = 0;
  return { pits: p, end: s.end, captured, taken };
}

/** Pits the player can sow from */
export function legalMoves(st: AyoState, side: Side = st.turn): number[] {
  const own = st.pits.map((v, i) => (mine(side, i) && v > 0 ? i : -1)).filter((i) => i >= 0);
  // If they have nothing, you must give them seeds
  if (sideSeeds(st.pits, other(side)) === 0) {
    const feeding = own.filter((i) => sideSeeds(play(st.pits, side, i).pits, other(side)) > 0);
    return feeding;
  }
  return own;
}

function finish(st: AyoState): MoveResult<AyoState> {
  const store = { a: st.store.a + sideSeeds(st.pits, "a"), b: st.store.b + sideSeeds(st.pits, "b") };
  const state = { ...st, pits: st.pits.map(() => 0), store };
  return { state, over: { winner: store.a > store.b ? "a" : store.b > store.a ? "b" : null, score_a: store.a, score_b: store.b } };
}

export function applyMove(st: AyoState, side: Side, pit: number): MoveResult<AyoState> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  if (!Number.isInteger(pit) || !mine(side, pit) || st.pits[pit] === 0) throw new MoveError("Pick one of your holes with seeds");
  if (!legalMoves(st, side).includes(pit)) throw new MoveError("They have no seeds. Pick a hole that gives them some");

  const r = play(st.pits, side, pit);
  const store = { ...st.store, [side]: st.store[side] + r.taken };
  const next: AyoState = { pits: r.pits, store, turn: other(side), last: { pit, end: r.end, captured: r.captured }, moves: st.moves + 1 };

  if (store.a >= WIN || store.b >= WIN || (store.a === 24 && store.b === 24)) {
    return { state: next, over: { winner: store.a >= WIN ? "a" : store.b >= WIN ? "b" : null, score_a: store.a, score_b: store.b } };
  }
  if (legalMoves(next).length === 0 || next.moves >= MAX_MOVES) return finish(next);
  return { state: next };
}
