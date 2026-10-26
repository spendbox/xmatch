/**
 * Ludo for two: player a is gold (bottom right), player b is purple (top left).
 * Each token: -1 in the yard, 0–50 on the track (counted from its own start),
 * 51–55 up its home lane, 56 home.
 * Roll a 6 to come out. A 6, a capture or a token reaching home gives another roll
 * (three 6s in a row lose the turn). Land on a lone token on a plain square to send it home;
 * two together form a block that can't be captured. Stars and start squares are safe.
 * Exact roll needed to reach home. First with all 4 home wins.
 * The server rolls the dice, so nobody can pick their number.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const HOME = 56;
/** Where each side starts on the shared 52-square track */
export const START: Record<Side, number> = { a: 26, b: 0 };
/** Safe squares on the shared track: the four starts and the four stars */
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

export type LudoLast = {
  by: Side;
  roll: number;
  /** A roll only (a move comes next, or there was nothing to move) */
  rolled?: boolean;
  /** No move was possible, or it was a third 6: the turn passed */
  passed?: boolean;
  token?: number;
  from?: number;
  to?: number;
  captured?: number[];
  out?: boolean;
  home?: boolean;
  again?: boolean;
  safe?: boolean;
};

export type LudoState = {
  tokens: Record<Side, number[]>;
  turn: Side;
  /** The roll waiting to be used (null: roll first) */
  roll: number | null;
  /** Sixes in a row this turn */
  sixes?: number;
  moves: number;
  last?: LudoLast | null;
};

export type LudoMove = { type: "roll" } | { type: "move"; token: number };

export function newLudo(first: Side = "a"): LudoState {
  return { tokens: { a: [-1, -1, -1, -1], b: [-1, -1, -1, -1] }, turn: first, roll: null, sixes: 0, moves: 0, last: null };
}

/** The shared track square a token is on (null in the yard, its home lane or home) */
export const square = (side: Side, p: number) => (p >= 0 && p <= 50 ? (START[side] + p) % 52 : null);

export function canMove(p: number, roll: number) {
  if (p === HOME) return false;
  if (p < 0) return roll === 6;
  return p + roll <= HOME;
}

export function legal(st: LudoState, side: Side): number[] {
  if (st.roll == null || st.turn !== side) return [];
  return st.tokens[side].flatMap((p, i) => (canMove(p, st.roll!) ? [i] : []));
}

/** A roll. With nothing to move (or a third 6), the turn passes. */
export function afterRoll(st: LudoState, side: Side, roll: number): LudoState {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  if (st.roll != null) throw new MoveError("Move a token first");
  const sixes = roll === 6 ? (st.sixes ?? 0) + 1 : 0;
  const base = { ...st, moves: st.moves + 1 };
  if (sixes === 3) return { ...base, roll: null, sixes: 0, turn: other(side), last: { by: side, roll, rolled: true, passed: true } };
  const next = { ...base, roll, sixes, last: { by: side, roll, rolled: true } };
  if (!legal(next, side).length) return { ...next, roll: null, sixes: 0, turn: other(side), last: { by: side, roll, rolled: true, passed: true } };
  return next;
}

export function moveToken(st: LudoState, side: Side, token: number): LudoState {
  const roll = st.roll;
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  if (roll == null) throw new MoveError("Roll first");
  const from = st.tokens[side][token];
  if (from === undefined || !canMove(from, roll)) throw new MoveError("That token can't move");
  const to = from < 0 ? 0 : from + roll;
  const mine = [...st.tokens[side]];
  mine[token] = to;
  const them = other(side);
  const theirs = [...st.tokens[them]];
  const sq = square(side, to);
  let captured: number[] = [];
  if (sq != null && !SAFE.includes(sq)) {
    captured = theirs.flatMap((p, i) => (square(them, p) === sq ? [i] : []));
    // Two of theirs together form a block: no capture
    if (captured.length >= 2) captured = [];
    captured.forEach((i) => (theirs[i] = -1));
  }
  const home = to === HOME;
  const again = roll === 6 || captured.length > 0 || home;
  return {
    tokens: { [side]: mine, [them]: theirs } as Record<Side, number[]>,
    turn: again ? side : them,
    roll: null,
    sixes: again ? st.sixes ?? 0 : 0,
    moves: st.moves + 1,
    last: { by: side, roll, token, from, to, captured, out: from < 0, home, again, safe: sq != null && SAFE.includes(sq) && from >= 0 },
  };
}

export const won = (st: LudoState, side: Side) => st.tokens[side].every((p) => p === HOME);
const homeCount = (st: LudoState, side: Side) => st.tokens[side].filter((p) => p === HOME).length;

/** Server: apply a roll (with a dice value from the server) or a move */
export function applyMove(st: LudoState, side: Side, mv: LudoMove, dice: () => number): MoveResult<LudoState> {
  const next = mv?.type === "roll" ? afterRoll(st, side, dice()) : mv?.type === "move" ? moveToken(st, side, Number(mv.token)) : null;
  if (!next) throw new MoveError("Unknown move");
  const winner = won(next, "a") ? "a" : won(next, "b") ? "b" : null;
  return { state: next, over: winner ? { winner, score_a: homeCount(next, "a"), score_b: homeCount(next, "b") } : undefined };
}

/** A simple computer move (previews): capture, then home, then come out, then go furthest */
export function pick(st: LudoState, side: Side): number {
  const ok = legal(st, side);
  const them = other(side);
  const score = (i: number) => {
    const p = st.tokens[side][i];
    const to = p < 0 ? 0 : p + st.roll!;
    const sq = square(side, to);
    if (sq != null && !SAFE.includes(sq) && st.tokens[them].some((q) => square(them, q) === sq)) return 1000;
    if (to === HOME) return 900;
    if (p < 0) return 800;
    return to;
  };
  return ok.sort((x, y) => score(y) - score(x))[0];
}
