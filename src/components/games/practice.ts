"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, GameActions, GameKind } from "@/lib/games";
import { MoveError, type MoveResult, type Side } from "@/lib/boardgames/types";
import * as whot from "@/lib/boardgames/whot";
import * as ayo from "@/lib/boardgames/ayo";
import * as ludo from "@/lib/boardgames/ludo";
import * as snakes from "@/lib/boardgames/snakes";
import * as xo from "@/lib/boardgames/xo";
import * as lastcard from "@/lib/boardgames/lastcard";

/** Games you can practise against the computer */
export const PRACTICE_GAMES: GameKind[] = ["whot", "ayo", "ludo", "snakes", "xo"];
export const BOT = "computer";
const ME = "me";
const SPECIAL = [2, 5, 14, 8, 1];

type Hidden = { hands: Record<Side, string[]>; deck: string[]; discard?: string[] };
/** Games where each player has a hidden hand */
const HANDS: GameKind[] = ["whot", "lastcard"];

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const dice = () => 1 + Math.floor(Math.random() * 6);

/** A fresh game against the computer, played on this phone only. You go first. */
function fresh(kind: GameKind): { game: Game; hidden: Hidden } {
  const t = Date.now();
  const hidden: Hidden = { hands: { a: [], b: [] }, deck: [] };
  let state: unknown;
  if (kind === "whot") {
    // Deal like the server does: 5 each, then the first plain card starts the pile
    const deck = shuffle(whot.fullDeck());
    hidden.hands = { a: deck.slice(0, 5), b: deck.slice(5, 10) };
    const k = deck.findIndex((c, i) => i >= 10 && !c.startsWith("whot") && !SPECIAL.includes(whot.parse(c).n));
    hidden.deck = [...deck.slice(10, k), ...deck.slice(k + 1)];
    state = { top: deck[k], called: null, turn: "a", count_a: 5, count_b: 5, market: hidden.deck.length, last: null, moves: 0 };
  } else if (kind === "ayo") state = { pits: ayo.startPits(), store: { a: 0, b: 0 }, turn: "a", last: null, moves: 0 };
  else if (kind === "ludo") state = ludo.newLudo();
  else if (kind === "xo") state = xo.newXO("a");
  else if (kind === "lastcard") {
    const d = lastcard.deal();
    hidden.hands = d.hands;
    hidden.deck = d.priv.deck;
    hidden.discard = d.priv.discard;
    state = d.state;
  } else state = snakes.newSnakes();
  return {
    hidden,
    game: {
      id: `practice-${t}`,
      kind,
      session_id: null,
      match_id: null,
      player_a: ME,
      player_b: BOT,
      me: "a",
      status: "active",
      state: state as Game["state"],
      score_a: 0,
      score_b: 0,
      winner: null,
      ended_by: null,
      ended_reason: null,
      deadline_at: null,
      started_at: new Date(t + 3200).toISOString(),
      ended_at: null,
      created_at: new Date(t).toISOString(),
      server_now: new Date(t).toISOString(),
      mine: HANDS.includes(kind) ? { hand: hidden.hands.a } : {},
      record: null,
    } as Game,
  };
}

/** The computer's move: simple, never cheats (it only sees its own Whot hand) */
function botMove(kind: GameKind, st: Record<string, unknown>, hidden: Hidden): unknown {
  if (kind === "whot") {
    const s = st as unknown as whot.WhotState;
    const hand = hidden.hands.b;
    const ok = hand.filter((c) => whot.canPlay(s, c));
    if (!ok.length) return { type: "market" };
    const rank = (c: string) => (c.startsWith("whot") ? 0 : SPECIAL.includes(whot.parse(c).n) ? 2 : 1);
    const card = ok.sort((x, y) => rank(y) - rank(x))[0];
    if (!card.startsWith("whot")) return { type: "play", card };
    // Call the shape it holds most of
    const count: Record<string, number> = {};
    hand.forEach((c) => c !== card && !c.startsWith("whot") && (count[whot.parse(c).shape] = (count[whot.parse(c).shape] ?? 0) + 1));
    const call = (Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] as whot.Shape) ?? "circle";
    return { type: "play", card, call };
  }
  if (kind === "ayo") {
    const s = st as unknown as ayo.AyoState;
    const moves = ayo.legalMoves(s, "b");
    // Take the move that captures the most seeds (a little randomness when it's even)
    return moves
      .map((p) => ({ p, gain: ayo.applyMove(s, "b", p).state.store.b + Math.random() * 0.5 }))
      .sort((x, y) => y.gain - x.gain)[0]?.p;
  }
  if (kind === "ludo") {
    const s = st as unknown as ludo.LudoState;
    return s.roll == null ? { type: "roll" } : { type: "move", token: ludo.pick(s, "b") };
  }
  if (kind === "xo") return xo.botMove(st as unknown as xo.XOState, "b");
  if (kind === "lastcard") {
    const s = st as unknown as lastcard.LastCardState;
    // You forgot to call "Last card!": the computer usually notices
    if (s.exposed === "a" && Math.random() < 0.7) return { type: "catch" };
    return lastcard.botMove(s, "b", hidden.hands.b);
  }
  return { type: "roll" };
}

function apply(kind: GameKind, st: Record<string, unknown>, side: Side, mv: unknown, hidden: Hidden): MoveResult<unknown> {
  if (kind === "whot") {
    const r = whot.applyMove(st as unknown as whot.WhotState, side, mv as whot.WhotMove, hidden.hands, hidden.deck);
    if (r.secrets?.a) hidden.hands.a = r.secrets.a.hand;
    if (r.secrets?.b) hidden.hands.b = r.secrets.b.hand;
    if (r.priv) hidden.deck = r.priv.deck;
    return r;
  }
  if (kind === "ayo") return ayo.applyMove(st as unknown as ayo.AyoState, side, Number(mv));
  if (kind === "ludo") return ludo.applyMove(st as unknown as ludo.LudoState, side, mv as ludo.LudoMove, dice);
  if (kind === "xo") return xo.applyMove(st as unknown as xo.XOState, side, mv as xo.XOMove);
  if (kind === "lastcard") {
    const r = lastcard.applyMove(st as unknown as lastcard.LastCardState, side, mv as lastcard.LastCardMove, hidden.hands, { deck: hidden.deck, discard: hidden.discard ?? [] });
    if (r.secrets?.a) hidden.hands.a = r.secrets.a.hand;
    if (r.secrets?.b) hidden.hands.b = r.secrets.b.hand;
    if (r.priv) {
      hidden.deck = r.priv.deck;
      hidden.discard = r.priv.discard;
    }
    return r;
  }
  return snakes.applyMove(st as unknown as snakes.SnakesState, side, mv as snakes.SnakesMove, dice);
}

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * Roughly how long the game screen takes to show a move (sowing seeds, hopping tokens,
 * cards flying), so the computer doesn't move while the last move is still playing out.
 */
function showMs(kind: GameKind, before: Record<string, unknown>, after: Record<string, unknown>, side: Side): number {
  const mine = side === "a";
  if (kind === "ayo") {
    const b = before as unknown as ayo.AyoState;
    const a = after as unknown as ayo.AyoState;
    const seeds = a.last ? b.pits[a.last.pit] : 4;
    const step = Math.max(110, 260 - seeds * 10);
    return 160 + seeds * (step + 20) + (a.last?.captured.length ? 650 : 0) + 200;
  }
  if (kind === "ludo") {
    const l = (after as unknown as ludo.LudoState).last;
    if (!l) return 300;
    if (l.rolled) return (mine ? 250 : 520) + (l.passed ? 700 : 0) + 200;
    const hops = l.from! < 0 ? 1 : l.to! - l.from!;
    return hops * 150 + (l.captured?.length ? 120 : 0) + 400;
  }
  if (kind === "snakes") {
    const l = (after as unknown as snakes.SnakesState).last;
    if (!l) return 300;
    return (mine ? 250 : 520) + (l.landed - l.from) * 140 + (l.ladder || l.snake ? 200 + 11 * 55 : 0) + 300;
  }
  if (kind === "xo") return (after as unknown as xo.XOState).last?.roundWon ? 1900 : 400;
  // Card games: the card flies to the pile
  return 600;
}

/** How long the computer "thinks" before its move: a few seconds, like a person */
function thinkMs(kind: GameKind, st: Record<string, unknown>): number {
  if (kind === "ludo") {
    const s = st as unknown as ludo.LudoState;
    if (s.roll == null) return between(900, 1900); // reach for the dice
    return ludo.legal(s, "b").length > 1 ? between(1400, 3000) : between(800, 1500); // choose a token
  }
  if (kind === "snakes") return between(1000, 2000);
  if (kind === "xo") return between(1500, 3200);
  if (kind === "ayo") return between(2200, 4500);
  // Whot and Last Card: look over the hand
  return between(1800, 4000);
}

/**
 * A practice game against the computer, all on this phone: no Keys, no score kept.
 * Gives the same game and actions a real game does, so the normal game screens play it.
 */
export function usePracticeGame(kind: GameKind | null) {
  const [game, setGame] = useState<Game | null>(null);
  const ref = useRef<Game | null>(null);
  const hidden = useRef<Hidden>({ hands: { a: [], b: [] }, deck: [] });
  /** When the last move finishes playing out on screen */
  const busyUntil = useRef(0);
  ref.current = game;

  const start = useCallback((k: GameKind) => {
    const f = fresh(k);
    hidden.current = f.hidden;
    setGame(f.game);
  }, []);

  useEffect(() => {
    if (kind) start(kind);
    else setGame(null);
  }, [kind, start]);

  const play = useCallback((side: Side, mv: unknown): string | null => {
    const g = ref.current;
    if (!g || g.status !== "active") return null;
    try {
      const before = g.state;
      const r = apply(g.kind, g.state, side, mv, hidden.current);
      busyUntil.current = Date.now() + showMs(g.kind, before, r.state as Record<string, unknown>, side);
      const next: Game = { ...g, state: r.state as Game["state"], mine: HANDS.includes(g.kind) ? { hand: hidden.current.hands.a } : {} };
      if (r.over) {
        Object.assign(next, {
          status: "done",
          ended_at: new Date().toISOString(),
          score_a: r.over.score_a,
          score_b: r.over.score_b,
          winner: r.over.winner === "a" ? ME : r.over.winner ? BOT : null,
        });
      }
      ref.current = next;
      setGame(next);
      return null;
    } catch (e) {
      if (e instanceof MoveError) return e.message;
      throw e;
    }
  }, []);

  // The computer waits for the last move to finish playing out on screen,
  // then "thinks" for a while, like a person would
  const st = game?.state as { turn?: Side; roll?: number | null; moves?: number } | undefined;
  useEffect(() => {
    const g = ref.current;
    if (!g || g.status !== "active" || st?.turn !== "b") return;
    const shown = Math.max(0, busyUntil.current - Date.now());
    const intro = new Date(g.started_at ?? 0).getTime() - Date.now() + 600;
    const t = setTimeout(() => {
      const cur = ref.current;
      if (!cur || cur.status !== "active" || (cur.state as { turn?: Side }).turn !== "b") return;
      play("b", botMove(cur.kind, cur.state, hidden.current));
    }, Math.max(intro, shown + thinkMs(g.kind, g.state)));
    return () => clearTimeout(t);
  }, [st?.turn, st?.moves, st?.roll, game?.status, play]);

  const act: GameActions = {
    start: async (k) => {
      start(k);
      return null;
    },
    respond: async () => null,
    cancel: async () => setGame((g) => (g ? { ...g, status: "cancelled", ended_at: new Date().toISOString() } : g)),
    call: async () => ({ data: null, error: null }),
    move: async (mv) => play("a", mv),
    refresh: async () => {},
    now: () => Date.now(),
  };
  return { game, act };
}
