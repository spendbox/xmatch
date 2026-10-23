/**
 * Bombshell, two players, best of 3 rounds. Each round both players secretly
 * hide 3 bombs in their own 3×3 field. Then you take turns tapping a tile in
 * the other player's field: a safe tile, or a bomb that blows up on you.
 * Set off all 3 of their bombs and you lose the round; find all 6 safe tiles
 * first and you win it.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const CELLS = 9;
export const BOMBS = 3;
export const SAFE = CELLS - BOMBS;
export const WINS_NEEDED = 2;

export type BombState = {
  phase: "hide" | "play";
  round: number;
  wins: Record<Side, number>;
  /** Who goes first this round (it swaps every round) */
  starter: Side;
  ready_a: boolean;
  ready_b: boolean;
  /** Whose turn it is (no one while hiding) */
  turn: Side | null;
  /** Each player's own field, as the other player has opened it: "." closed, "s" safe, "x" bomb */
  open_a: string;
  open_b: string;
  /** Bombs each player has set off (in the other's field) */
  boom_a: number;
  boom_b: number;
  last: { by: Side; cell: number; bomb: boolean } | null;
  /** How the last round ended, and where everyone's bombs were */
  result: { round: number; winner: Side; why: "boom" | "clear"; bombs: Record<Side, number[]>; open: Record<Side, string> } | null;
  moves: number;
};
export type BombSecret = { bombs: number[] };
export type BombMove = { type: "hide"; cells: number[] } | { type: "pick"; cell: number };

const CLOSED = ".".repeat(CELLS);

/** The field the player picks in: the other player's */
export const fieldOf = (st: BombState, picker: Side) => (picker === "a" ? st.open_b : st.open_a);
export const safeFound = (st: BombState, picker: Side) => [...fieldOf(st, picker)].filter((c) => c === "s").length;

export function applyMove(st: BombState, side: Side, mv: BombMove, bombs: Record<Side, number[]>): MoveResult<BombState, BombSecret> {
  const opp = other(side);

  if (mv.type === "hide") {
    if (st.phase !== "hide") throw new MoveError("The round has started");
    if (st[`ready_${side}`]) throw new MoveError("Your bombs are hidden");
    const cells = [...new Set((mv.cells ?? []).map(Number))];
    if (cells.length !== BOMBS || cells.some((c) => !Number.isInteger(c) || c < 0 || c >= CELLS)) throw new MoveError("Hide exactly 3 bombs");
    const next: BombState = { ...st, [`ready_${side}`]: true, moves: st.moves + 1 };
    if (next.ready_a && next.ready_b) {
      next.phase = "play";
      next.turn = st.starter;
    }
    return { state: next, secrets: { [side]: { bombs: cells.sort((x, y) => x - y) } } };
  }

  if (st.phase !== "play") throw new MoveError("Hide your bombs first");
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const cell = Number(mv.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) throw new MoveError("Pick a tile");
  const key = opp === "a" ? "open_a" : "open_b";
  const field = st[key];
  if (field[cell] !== ".") throw new MoveError("That tile is open");

  const bomb = bombs[opp].includes(cell);
  const opened = field.slice(0, cell) + (bomb ? "x" : "s") + field.slice(cell + 1);
  const next: BombState = {
    ...st,
    [key]: opened,
    [`boom_${side}`]: st[`boom_${side}`] + (bomb ? 1 : 0),
    turn: opp,
    last: { by: side, cell, bomb },
    moves: st.moves + 1,
  };

  // Did the round end?
  const blew = next[`boom_${side}`] >= BOMBS;
  const cleared = [...opened].filter((c) => c === "s").length >= SAFE;
  if (!blew && !cleared) return { state: next };

  const winner = blew ? opp : side;
  const wins = { ...st.wins, [winner]: st.wins[winner] + 1 };
  const result: BombState["result"] = {
    round: st.round,
    winner,
    why: blew ? "boom" : "clear",
    bombs: { a: bombs.a, b: bombs.b },
    open: { a: next.open_a, b: next.open_b },
  };
  if (wins[winner] >= WINS_NEEDED) {
    return {
      state: { ...next, wins, result, turn: null },
      over: { winner, score_a: wins.a, score_b: wins.b },
    };
  }
  // Next round: hide again, and the other player goes first
  return {
    state: {
      ...next,
      phase: "hide",
      round: st.round + 1,
      wins,
      starter: other(st.starter),
      ready_a: false,
      ready_b: false,
      turn: null,
      open_a: CLOSED,
      open_b: CLOSED,
      boom_a: 0,
      boom_b: 0,
      result,
    },
    secrets: { a: { bombs: [] }, b: { bombs: [] } },
  };
}
