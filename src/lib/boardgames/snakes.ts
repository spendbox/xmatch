/**
 * Snakes & Ladders for two. Start off the board (0), race to 100.
 * Ladders lift you, snakes drop you. A 6 rolls again. You need the exact number to land on 100.
 * The server rolls the dice, so nobody can pick their number.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const LADDERS: Record<number, number> = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
export const SNAKES: Record<number, number> = { 27: 5, 40: 3, 54: 31, 66: 45, 89: 53, 95: 76, 99: 41 };

export type SnakesLast = { by: Side; roll: number; from: number; landed: number; to: number; ladder?: boolean; snake?: boolean; again?: boolean; stuck?: boolean };
export type SnakesState = {
  pos: Record<Side, number>;
  turn: Side;
  moves: number;
  last?: SnakesLast | null;
};
export type SnakesMove = { type: "roll" };

export function newSnakes(first: Side = "a"): SnakesState {
  return { pos: { a: 0, b: 0 }, turn: first, moves: 0, last: null };
}

export function roll(st: SnakesState, side: Side, n: number): SnakesState {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const from = st.pos[side];
  const stuck = from + n > 100;
  const landed = stuck ? from : from + n;
  const to = LADDERS[landed] ?? SNAKES[landed] ?? landed;
  const again = n === 6 && to !== 100;
  return {
    pos: { ...st.pos, [side]: to } as Record<Side, number>,
    turn: again ? side : other(side),
    moves: st.moves + 1,
    last: { by: side, roll: n, from, landed, to, ladder: to > landed, snake: to < landed, again, stuck },
  };
}

/** Server: a roll, with a dice value from the server */
export function applyMove(st: SnakesState, side: Side, mv: SnakesMove, dice: () => number): MoveResult<SnakesState> {
  if (mv?.type !== "roll") throw new MoveError("Unknown move");
  const next = roll(st, side, dice());
  const winner = next.pos.a === 100 ? "a" : next.pos.b === 100 ? "b" : null;
  return { state: next, over: winner ? { winner, score_a: next.pos.a, score_b: next.pos.b } : undefined };
}
