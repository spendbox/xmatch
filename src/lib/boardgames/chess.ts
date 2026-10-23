/**
 * Chess with the full rules (check, castling, en passant, promotion, and draws by
 * stalemate, repetition, the 50-move rule and too little material), using chess.js.
 * Player a plays white. The moves so far are kept so repetition can be counted.
 */
import { Chess } from "chess.js";
import { MoveError, type MoveResult, type Side } from "./types";

export type ChessState = {
  fen: string;
  turn: Side;
  /** Every move so far, in standard notation */
  san: string[];
  last: { from: string; to: string; san: string } | null;
  check: boolean;
  /** Pieces each side has taken (letters, e.g. "pn") */
  taken: { a: string; b: string };
  moves: number;
};
export type ChessMove = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Rebuild the game from the moves so far */
export function replay(san: string[]) {
  const g = new Chess();
  for (const m of san) g.move(m);
  return g;
}

export function applyMove(st: ChessState, side: Side, mv: ChessMove): MoveResult<ChessState> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const g = replay(st.san);
  let made;
  try {
    made = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion ?? "q" });
  } catch {
    throw new MoveError("That move isn't allowed");
  }
  const taken = { ...st.taken };
  if (made.captured) taken[side] += made.captured;
  const next: ChessState = {
    fen: g.fen(),
    turn: g.turn() === "w" ? "a" : "b",
    san: [...st.san, made.san],
    last: { from: made.from, to: made.to, san: made.san },
    check: g.inCheck(),
    taken,
    moves: st.moves + 1,
  };
  if (g.isCheckmate()) return { state: next, over: { winner: side, score_a: side === "a" ? 1 : 0, score_b: side === "b" ? 1 : 0 } };
  if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition() || g.isInsufficientMaterial()) {
    return { state: next, over: { winner: null, score_a: 0, score_b: 0 } };
  }
  return { state: next };
}
