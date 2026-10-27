/**
 * Last Card, two players. Cards are "colour:value": colours r y g b, values 0–9, skip, rev, +2;
 * wild cards are "w:wild" and "w:+4". Match the colour or the value, or play a wild (and pick
 * the colour). With two players, Skip and Reverse both mean you go again.
 *   +2: they draw 2, unless they answer with a +2 or a +4 (it stacks).
 *   +4: they draw 4, unless they answer with a +4 (it stacks).
 * Can't (or don't want to) play? Draw one. If it fits, you may play it straight away, or keep it.
 * Down to your last card? Tap "Last card!" as you play the one before it. Forget, and they can
 * catch you before your next go: you draw 2.
 * First to play all their cards wins.
 */
import { MoveError, other, type MoveResult, type Side } from "./types";

export const COLOURS = ["r", "y", "g", "b"] as const;
export type Colour = (typeof COLOURS)[number];
export const HAND_SIZE = 7;

export type LastCardState = {
  /** The card on top of the pile */
  top: string;
  /** The colour in play (a wild's choice, or the top card's colour) */
  colour: Colour;
  /** Cards owed by whoever's turn it is (from +2 and +4), unless they stack */
  pending: number;
  /** What's stacking: "+2" lets them answer with +2 or +4, "+4" only with +4 */
  stack: "+2" | "+4" | null;
  turn: Side;
  count_a: number;
  count_b: number;
  deck: number;
  /** You drew a card that fits: play it, or keep it and pass */
  drew: boolean;
  /** Someone went down to one card without calling it, and can be caught */
  exposed: Side | null;
  last: { by: Side; card?: string; drew?: number; colour?: Colour; caught?: boolean; called?: boolean; note: string } | null;
  moves: number;
};
export type LastCardHand = { hand: string[] };
export type LastCardPrivate = { deck: string[]; discard: string[] };
export type LastCardMove =
  | { type: "play"; card: string; colour?: Colour; call?: boolean }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "catch" };

export const parse = (card: string) => {
  const [c, v] = card.split(":");
  return { colour: c as Colour | "w", value: v };
};
export const isWild = (card: string) => card.startsWith("w:");
export const isAction = (card: string) => ["skip", "rev", "+2", "+4", "wild"].includes(parse(card).value);

export function fullDeck(): string[] {
  const out: string[] = [];
  for (const c of COLOURS) {
    out.push(`${c}:0`);
    for (let n = 1; n <= 9; n++) out.push(`${c}:${n}`, `${c}:${n}`);
    for (const v of ["skip", "rev", "+2"]) out.push(`${c}:${v}`, `${c}:${v}`);
  }
  for (let i = 0; i < 4; i++) out.push("w:wild", "w:+4");
  return out;
}

/** Can this card go on the pile now? */
export function canPlay(st: LastCardState, card: string) {
  const c = parse(card);
  if (st.pending > 0) {
    if (st.stack === "+4") return c.value === "+4";
    return c.value === "+2" || c.value === "+4";
  }
  if (c.colour === "w") return true;
  const t = parse(st.top);
  return c.colour === st.colour || c.value === t.value;
}

function shuffle<T>(a: T[], rnd: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Take n cards from the deck; when it runs out, the pile (all but its top card) is shuffled in */
function take(n: number, deck: string[], discard: string[], rnd: () => number) {
  const got: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!deck.length && discard.length) deck.push(...shuffle(discard.splice(0), rnd));
    if (!deck.length) break;
    got.push(deck.shift()!);
  }
  return got;
}

const count = (hands: Record<Side, string[]>) => ({ count_a: hands.a.length, count_b: hands.b.length });

export function applyMove(
  st: LastCardState,
  side: Side,
  mv: LastCardMove,
  hands: Record<Side, string[]>,
  priv: LastCardPrivate,
  rnd: () => number = Math.random,
): MoveResult<LastCardState, LastCardHand, LastCardPrivate> {
  const opp = other(side);
  const h = { a: [...hands.a], b: [...hands.b] } as Record<Side, string[]>;
  const deck = [...priv.deck];
  const discard = [...priv.discard];
  const result = (state: LastCardState, over?: Side): MoveResult<LastCardState, LastCardHand, LastCardPrivate> => ({
    state: { ...state, ...count(h), deck: deck.length },
    secrets: { a: { hand: h.a }, b: { hand: h.b } },
    priv: { deck, discard },
    ...(over ? { over: { winner: over, score_a: over === "a" ? 1 : 0, score_b: over === "b" ? 1 : 0 } } : {}),
  });

  // Catch them: they went down to one card without calling it (any time before their next go)
  if (mv.type === "catch") {
    if (st.exposed !== opp) throw new MoveError("Nothing to catch");
    h[opp].push(...take(2, deck, discard, rnd));
    return result({ ...st, exposed: null, last: { by: side, caught: true, drew: 2, note: "Caught! +2" }, moves: st.moves + 1 });
  }

  if (st.turn !== side) throw new MoveError("Wait for your turn");
  // Your go has started: you can't be caught any more, and they missed their chance on you
  const exposed = st.exposed === side ? null : st.exposed;

  if (mv.type === "draw") {
    if (st.drew) throw new MoveError("Play the card you drew, or keep it");
    if (st.pending > 0) {
      // Take what's owed, and your go ends
      const got = take(st.pending, deck, discard, rnd);
      h[side].push(...got);
      return result({ ...st, pending: 0, stack: null, exposed, turn: opp, drew: false, last: { by: side, drew: got.length, note: `Drew ${got.length}` }, moves: st.moves + 1 });
    }
    const got = take(1, deck, discard, rnd);
    h[side].push(...got);
    const fits = got.length > 0 && canPlay(st, got[0]);
    return result({
      ...st,
      exposed,
      // A card that fits: you can play it now. Otherwise your go ends
      turn: fits ? side : opp,
      drew: fits,
      last: { by: side, drew: got.length, note: got.length ? "Drew a card" : "No cards left to draw" },
      moves: st.moves + 1,
    });
  }

  if (mv.type === "pass") {
    if (!st.drew) throw new MoveError("Play a card or draw one");
    return result({ ...st, exposed, turn: opp, drew: false, last: { by: side, note: "Kept it" }, moves: st.moves + 1 });
  }

  // Play a card
  const mine = h[side];
  const k = mine.indexOf(mv.card);
  if (k < 0) throw new MoveError("That card isn't in your hand");
  if (st.drew && k !== mine.length - 1) throw new MoveError("You can only play the card you just drew");
  if (!canPlay(st, mv.card)) {
    throw new MoveError(st.pending ? (st.stack === "+4" ? `Play a +4, or draw ${st.pending}` : `Play a +2 or +4, or draw ${st.pending}`) : "That card doesn't match");
  }
  const c = parse(mv.card);
  if (c.colour === "w" && (!mv.colour || !COLOURS.includes(mv.colour))) throw new MoveError("Pick a colour");
  mine.splice(k, 1);
  discard.push(st.top);
  const colour = (c.colour === "w" ? mv.colour : c.colour) as Colour;
  // Went down to one card: did you call it?
  const nowExposed: Side | null = mine.length === 1 && !mv.call ? side : exposed === side ? null : exposed;

  let pending = 0;
  let stack: LastCardState["stack"] = null;
  let again = false;
  let note = "";
  if (c.value === "+2") {
    pending = st.pending + 2;
    stack = st.stack === "+4" ? "+4" : "+2";
    note = `+${pending}`;
  } else if (c.value === "+4") {
    pending = st.pending + 4;
    stack = "+4";
    note = `+${pending}`;
  } else if (c.value === "skip") {
    again = true;
    note = "Skip";
  } else if (c.value === "rev") {
    again = true;
    note = "Reverse";
  } else if (c.value === "wild") {
    note = "Wild";
  }

  const state: LastCardState = {
    ...st,
    top: mv.card,
    colour,
    pending,
    stack,
    drew: false,
    exposed: nowExposed,
    turn: again && mine.length > 0 ? side : opp,
    last: { by: side, card: mv.card, ...(c.colour === "w" ? { colour } : {}), ...(mv.call && mine.length === 1 ? { called: true } : {}), note },
    moves: st.moves + 1,
  };
  return result(state, mine.length === 0 ? side : undefined);
}

/** A computer player for practice */
export function botMove(st: LastCardState, side: Side, hand: string[]): LastCardMove {
  const playable = hand.filter((c) => canPlay(st, c));
  if (st.drew) {
    const drawn = hand[hand.length - 1];
    return canPlay(st, drawn) ? { type: "play", card: drawn, ...(isWild(drawn) ? { colour: bestColour(hand) } : {}), call: hand.length === 2 } : { type: "pass" };
  }
  if (!playable.length) return { type: "draw" };
  // Keep wilds for later; play actions when it hurts them
  const pick =
    playable.find((c) => !isWild(c) && isAction(c)) ?? playable.find((c) => !isWild(c)) ?? playable[0];
  return { type: "play", card: pick, ...(isWild(pick) ? { colour: bestColour(hand.filter((c) => c !== pick)) } : {}), call: hand.length === 2 && Math.random() < 0.8 };
}

/** The colour you hold most of */
export function bestColour(hand: string[]): Colour {
  const n: Record<Colour, number> = { r: 0, y: 0, g: 0, b: 0 };
  for (const c of hand) {
    const p = parse(c);
    if (p.colour !== "w") n[p.colour] += 1;
  }
  return COLOURS.reduce((a, b) => (n[b] > n[a] ? b : a), "r");
}

/** A fresh game: shuffled deck, 7 each, and a number card to start the pile */
export function deal(rnd: () => number = Math.random) {
  const deck = shuffle(fullDeck(), rnd);
  const a = deck.splice(0, HAND_SIZE);
  const b = deck.splice(0, HAND_SIZE);
  const k = deck.findIndex((c) => /^[rygb]:\d$/.test(c));
  const top = deck.splice(k, 1)[0];
  const state: LastCardState = {
    top,
    colour: parse(top).colour as Colour,
    pending: 0,
    stack: null,
    turn: "a",
    count_a: HAND_SIZE,
    count_b: HAND_SIZE,
    deck: deck.length,
    drew: false,
    exposed: null,
    last: null,
    moves: 0,
  };
  return { state, hands: { a, b }, priv: { deck, discard: [] as string[] } };
}
