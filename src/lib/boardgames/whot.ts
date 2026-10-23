/**
 * Whot, two players. Cards are "shape:number": circle, triangle, cross, square,
 * star, and Whot 20. Play a card that matches the top card's shape or number,
 * or a Whot (then call the shape the next card must be).
 * Special cards (with two players, you play again after one):
 *   1 Hold on · 5 Pick three · 8 Suspension · 14 General market (they pick one).
 *   2 Pick two stacks: the other player can answer with a 2 of their own to pass
 *   it back (2 more each time), or pick them all and miss their turn.
 * Can't play? Go to market: pick one card and your turn ends.
 * First to finish their cards wins. If the market runs out, the lowest total wins
 * (stars count double, Whot is 20).
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const SHAPES = ["circle", "triangle", "cross", "square", "star"] as const;
export type Shape = (typeof SHAPES)[number];

export type WhotState = {
  /** The card on top of the pile */
  top: string;
  /** After a Whot: the shape that must be played next */
  called: Shape | null;
  /** Pick two: cards the player whose turn it is has to pick unless they play a 2 */
  pending?: number;
  turn: Side;
  count_a: number;
  count_b: number;
  market: number;
  last: { by: Side; card?: string; picked?: number; called?: Shape; note: string } | null;
  moves: number;
};
export type WhotHand = { hand: string[] };
export type WhotPrivate = { deck: string[] };
export type WhotMove = { type: "play"; card: string; call?: Shape } | { type: "market" };

export const HAND_SIZE = 5;

export function fullDeck(): string[] {
  const nums: Record<Shape, number[]> = {
    circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
    square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
    star: [1, 2, 3, 4, 5, 7, 8],
  };
  const deck = SHAPES.flatMap((s) => nums[s].map((n) => `${s}:${n}`));
  for (let i = 0; i < 5; i++) deck.push("whot:20");
  return deck;
}

export const parse = (card: string) => {
  const [shape, n] = card.split(":");
  return { shape: shape as Shape | "whot", n: Number(n) };
};
export const points = (card: string) => {
  const c = parse(card);
  return c.shape === "star" ? c.n * 2 : c.n;
};
const total = (hand: string[]) => hand.reduce((n, c) => n + points(c), 0);

/** Can this card go on the pile now? */
export function canPlay(st: WhotState, card: string) {
  const c = parse(card);
  // Facing a pick two: only another 2 answers it
  if ((st.pending ?? 0) > 0) return c.shape !== "whot" && c.n === 2;
  if (c.shape === "whot") return true;
  if (st.called) return c.shape === st.called;
  const t = parse(st.top);
  return c.shape === t.shape || c.n === t.n;
}

/** What each special card does */
function special(n: number): { again: boolean; pick: number; note: string } {
  if (n === 1) return { again: true, pick: 0, note: "Hold on" };
  if (n === 5) return { again: true, pick: 3, note: "Pick three" };
  if (n === 8) return { again: true, pick: 0, note: "Suspension" };
  if (n === 14) return { again: true, pick: 1, note: "General market" };
  return { again: false, pick: 0, note: "" };
}

function byCount(hands: Record<Side, string[]>) {
  const ta = total(hands.a);
  const tb = total(hands.b);
  const winner: Side | null = ta < tb ? "a" : tb < ta ? "b" : null;
  return { winner, score_a: winner === "a" ? 1 : 0, score_b: winner === "b" ? 1 : 0 };
}

export function applyMove(
  st: WhotState,
  side: Side,
  mv: WhotMove,
  hands: Record<Side, string[]>,
  deck: string[],
): MoveResult<WhotState, WhotHand, WhotPrivate> {
  if (st.turn !== side) throw new MoveError("Wait for your turn");
  const mine = [...hands[side]];
  const theirs = [...hands[other(side)]];
  const market = [...deck];
  const opp = other(side);
  let next: WhotState;

  const owed = st.pending ?? 0;
  if (mv.type === "market") {
    // Pick one, or every card owed from a pick two (and miss your turn)
    let picked = 0;
    for (let i = 0; i < Math.max(1, owed) && market.length; i++) {
      mine.push(market.shift()!);
      picked += 1;
    }
    next = {
      ...st,
      pending: 0,
      turn: opp,
      market: market.length,
      last: { by: side, picked, note: owed ? `Picked ${picked}` : "Went to market" },
      moves: st.moves + 1,
    };
  } else {
    const k = mine.indexOf(mv.card);
    if (k < 0) throw new MoveError("That card isn't in your hand");
    if (!canPlay(st, mv.card)) {
      throw new MoveError(owed ? `Play a 2, or pick ${owed}` : st.called ? `Play a ${st.called} or a Whot` : "That card doesn't match");
    }
    const c = parse(mv.card);
    if (c.shape === "whot" && (!mv.call || !SHAPES.includes(mv.call))) throw new MoveError("Call a shape");
    mine.splice(k, 1);
    // A 2 passes the pick two on (2 more each time); the other player answers or picks
    if (c.shape !== "whot" && c.n === 2) {
      next = {
        ...st,
        top: mv.card,
        called: null,
        pending: owed + 2,
        turn: mine.length > 0 ? opp : side,
        market: market.length,
        last: { by: side, card: mv.card, note: `Pick ${owed + 2}` },
        moves: st.moves + 1,
      };
      const handsNow = { [side]: mine, [opp]: theirs } as Record<Side, string[]>;
      next.count_a = handsNow.a.length;
      next.count_b = handsNow.b.length;
      return {
        state: next,
        secrets: { a: { hand: handsNow.a }, b: { hand: handsNow.b } },
        priv: { deck: market },
        ...(mine.length === 0 ? { over: { winner: side, score_a: side === "a" ? 1 : 0, score_b: side === "b" ? 1 : 0 } } : {}),
      };
    }
    const fx = c.shape === "whot" ? { again: false, pick: 0, note: `Whot! Wants ${mv.call}` } : special(c.n);
    let picked = 0;
    for (let i = 0; i < fx.pick && market.length; i++) {
      theirs.push(market.shift()!);
      picked += 1;
    }
    next = {
      ...st,
      top: mv.card,
      called: c.shape === "whot" ? (mv.call as Shape) : null,
      pending: 0,
      turn: fx.again && mine.length > 0 ? side : opp,
      market: market.length,
      last: { by: side, card: mv.card, ...(picked ? { picked } : {}), ...(c.shape === "whot" ? { called: mv.call } : {}), note: fx.note },
      moves: st.moves + 1,
    };
  }

  const nextHands = { [side]: mine, [opp]: theirs } as Record<Side, string[]>;
  next.count_a = nextHands.a.length;
  next.count_b = nextHands.b.length;
  const result: MoveResult<WhotState, WhotHand, WhotPrivate> = {
    state: next,
    secrets: { a: { hand: nextHands.a }, b: { hand: nextHands.b } },
    priv: { deck: market },
  };

  if (mine.length === 0) result.over = { winner: side, score_a: side === "a" ? 1 : 0, score_b: side === "b" ? 1 : 0 };
  else if (market.length === 0) result.over = byCount(nextHands);
  return result;
}
