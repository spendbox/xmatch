/** Shared shapes for the turn-based board and card games (Whot, Checkers, Chess, Ayo). */
export type Side = "a" | "b";

export const other = (s: Side): Side => (s === "a" ? "b" : "a");

/** How a finished game ended */
export type Outcome = { winner: Side | null; score_a: number; score_b: number };

/** What a move produces: the new public state, and (Whot) the new hidden parts */
export type MoveResult<S, H = unknown, P = unknown> = {
  state: S;
  /** Each player's hidden part (their Whot hand) */
  secrets?: Partial<Record<Side, H>>;
  /** Parts nobody sees (the Whot market) */
  priv?: P;
  over?: Outcome;
};

export class MoveError extends Error {}
