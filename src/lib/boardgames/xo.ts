/**
 * X & O, the vanishing kind. Get 3 in a row. Each player only ever has 3 marks on the board:
 * placing a 4th takes away your oldest one, so there are no draws. First to win 3 rounds wins.
 * The loser of a round starts the next one. No move timer.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
export const MAX_MARKS = 3;
export const WIN_ROUNDS = 3;

export type XOState = {
  /** 9 cells: "." empty, "a" or "b" */
  board: string;
  /** Each player's marks, oldest first */
  order: Record<Side, number[]>;
  turn: Side;
  round: number;
  wins: Record<Side, number>;
  /** Who started this round */
  starter: Side;
  /** Each round's winner, in order */
  rounds: Side[];
  last: {
    by: Side;
    cell: number;
    /** The oldest mark that vanished */
    removed?: number;
    /** A round was won: the board as it ended and the winning line */
    roundWon?: { board: string; line: number[]; winner: Side };
  } | null;
  moves: number;
};
export type XOMove = { cell: number };

export function newXO(starter: Side = "a"): XOState {
  return { board: ".........", order: { a: [], b: [] }, turn: starter, round: 1, wins: { a: 0, b: 0 }, starter, rounds: [], last: null, moves: 0 };
}

/** The mark that goes next time this player places one (it fades as a warning) */
export function nextToVanish(st: XOState, side: Side): number | null {
  const o = st.order[side];
  return o.length >= MAX_MARKS ? o[0] : null;
}

export function winLine(board: string, side: Side): number[] | null {
  return LINES.find((l) => l.every((i) => board[i] === side)) ?? null;
}

export function applyMove(st: XOState, side: Side, mv: XOMove): MoveResult<XOState> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const cell = Number(mv?.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new MoveError("Pick a square");
  if (st.board[cell] !== ".") throw new MoveError("That square is taken");

  const cells = st.board.split("");
  const order = { a: [...st.order.a], b: [...st.order.b] };
  let removed: number | undefined;
  // Already 3 on the board: your oldest one goes
  if (order[side].length >= MAX_MARKS) {
    removed = order[side].shift()!;
    cells[removed] = ".";
  }
  cells[cell] = side;
  order[side].push(cell);
  const board = cells.join("");
  const line = winLine(board, side);

  if (!line) {
    return {
      state: { ...st, board, order, turn: other(side), last: { by: side, cell, ...(removed !== undefined ? { removed } : {}) }, moves: st.moves + 1 },
    };
  }

  // Round won
  const wins = { ...st.wins, [side]: st.wins[side] + 1 } as Record<Side, number>;
  const rounds = [...st.rounds, side];
  const roundWon = { board, line, winner: side };
  if (wins[side] >= WIN_ROUNDS) {
    return {
      state: { ...st, board, order, wins, rounds, last: { by: side, cell, ...(removed !== undefined ? { removed } : {}), roundWon }, moves: st.moves + 1 },
      over: { winner: side, score_a: wins.a, score_b: wins.b },
    };
  }
  // Next round: a clear board, and the loser starts
  const starter = other(side);
  return {
    state: {
      board: ".........",
      order: { a: [], b: [] },
      turn: starter,
      round: st.round + 1,
      wins,
      starter,
      rounds,
      last: { by: side, cell, ...(removed !== undefined ? { removed } : {}), roundWon },
      moves: st.moves + 1,
    },
  };
}

/** A computer player for practice: win if it can, block if it must, else play well */
export function botMove(st: XOState, side: Side): XOMove {
  const empty = [...st.board].map((c, i) => (c === "." ? i : -1)).filter((i) => i >= 0);
  const opp = other(side);
  const after = (s: XOState, who: Side, cell: number) => {
    const cells = s.board.split("");
    const o = [...s.order[who]];
    if (o.length >= MAX_MARKS) cells[o.shift()!] = ".";
    cells[cell] = who;
    return cells.join("");
  };
  const win = empty.find((c) => winLine(after(st, side, c), side));
  if (win !== undefined) return { cell: win };
  // Would they win next move from here? Block that square
  const threat = empty.find((c) => winLine(after({ ...st, turn: opp }, opp, c), opp));
  if (threat !== undefined) return { cell: threat };
  const pref = [4, 0, 2, 6, 8, 1, 3, 5, 7].filter((c) => empty.includes(c));
  // A little randomness so it isn't the same every time
  return { cell: Math.random() < 0.25 ? empty[Math.floor(Math.random() * empty.length)] : pref[0] };
}
