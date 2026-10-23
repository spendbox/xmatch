/**
 * Checkers (draughts) on an 8×8 board, standard rules: men move and capture
 * forward, kings move one square any diagonal way, captures are compulsory,
 * keep jumping while you can, reaching the far row makes a king (and ends the turn).
 * Board: 64 characters, row 0 at the top. "a"/"b" men, "A"/"B" kings, "." empty.
 * Player a starts at the bottom and moves up.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export type CheckersState = {
  board: string;
  turn: Side;
  /** A piece in the middle of a multi-jump: it must keep jumping */
  chain: number | null;
  /** Moves in a row with no capture or new king (80 = draw) */
  quiet: number;
  captured: { a: number; b: number };
  last: { from: number; to: number; took: number[] } | null;
  moves: number;
};

export type CheckersMove = { from: number; to: number };
export type CheckersOption = { from: number; to: number; take: number | null };

export const QUIET_DRAW = 80;

export function startBoard() {
  let s = "";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) s += (r + c) % 2 === 1 ? (r < 3 ? "b" : r > 4 ? "a" : ".") : ".";
  return s;
}

const owner = (ch: string): Side | null => (ch === "a" || ch === "A" ? "a" : ch === "b" || ch === "B" ? "b" : null);
const isKing = (ch: string) => ch === "A" || ch === "B";

function dirs(ch: string): [number, number][] {
  if (isKing(ch)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return owner(ch) === "a" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function pieceOptions(board: string, i: number): { steps: CheckersOption[]; jumps: CheckersOption[] } {
  const ch = board[i];
  const me = owner(ch);
  const steps: CheckersOption[] = [];
  const jumps: CheckersOption[] = [];
  if (!me) return { steps, jumps };
  const r = Math.floor(i / 8);
  const c = i % 8;
  for (const [dr, dc] of dirs(ch)) {
    const r1 = r + dr, c1 = c + dc;
    if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const j1 = r1 * 8 + c1;
    if (board[j1] === ".") steps.push({ from: i, to: j1, take: null });
    else if (owner(board[j1]) === other(me)) {
      const r2 = r1 + dr, c2 = c1 + dc;
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
      const j2 = r2 * 8 + c2;
      if (board[j2] === ".") jumps.push({ from: i, to: j2, take: j1 });
    }
  }
  return { steps, jumps };
}

/** Every move the player whose turn it is may make (captures only, when one is possible) */
export function legalMoves(st: CheckersState, side: Side = st.turn): CheckersOption[] {
  if (st.chain !== null) return side === st.turn ? pieceOptions(st.board, st.chain).jumps : [];
  const steps: CheckersOption[] = [];
  const jumps: CheckersOption[] = [];
  for (let i = 0; i < 64; i++) {
    if (owner(st.board[i]) !== side) continue;
    const o = pieceOptions(st.board, i);
    steps.push(...o.steps);
    jumps.push(...o.jumps);
  }
  return jumps.length ? jumps : steps;
}

export function applyMove(st: CheckersState, side: Side, mv: CheckersMove): MoveResult<CheckersState> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const opt = legalMoves(st, side).find((o) => o.from === mv.from && o.to === mv.to);
  if (!opt) throw new MoveError(legalMoves(st, side).some((o) => o.take !== null) ? "You have to capture" : "You can't move there");

  const b = st.board.split("");
  let piece = b[opt.from];
  b[opt.from] = ".";
  const captured = { ...st.captured };
  if (opt.take !== null) {
    b[opt.take] = ".";
    captured[side] += 1;
  }
  const row = Math.floor(opt.to / 8);
  const crowned = !isKing(piece) && ((side === "a" && row === 0) || (side === "b" && row === 7));
  if (crowned) piece = piece.toUpperCase();
  b[opt.to] = piece;
  const board = b.join("");

  const took = st.chain !== null && st.last ? [...st.last.took, ...(opt.take !== null ? [opt.take] : [])] : opt.take !== null ? [opt.take] : [];
  const keepJumping = opt.take !== null && !crowned && pieceOptions(board, opt.to).jumps.length > 0;
  const quiet = opt.take !== null || crowned ? 0 : st.quiet + 1;
  const next: CheckersState = {
    board,
    turn: keepJumping ? side : other(side),
    chain: keepJumping ? opt.to : null,
    quiet,
    captured,
    last: { from: st.chain !== null && st.last ? st.last.from : opt.from, to: opt.to, took },
    moves: st.moves + 1,
  };

  const score = { score_a: captured.a, score_b: captured.b };
  if (!keepJumping && legalMoves(next).length === 0) return { state: next, over: { winner: side, ...score } };
  if (quiet >= QUIET_DRAW) return { state: next, over: { winner: null, ...score } };
  return { state: next };
}
