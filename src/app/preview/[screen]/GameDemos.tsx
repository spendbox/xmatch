"use client";

import { useMemo } from "react";
import { GameArena } from "@/components/games/GameArena";
import { GameLauncher } from "@/components/games/GameLauncher";
import type { Game, GameActions } from "@/lib/games";

const names = { me: "Velvet Fox", them: "Golden Owl" };

const act: GameActions = {
  start: async () => null,
  respond: async () => null,
  cancel: async () => {},
  call: async () => ({ data: null, error: null }),
  move: async () => null,
  refresh: async () => {},
  now: () => Date.now(),
};

const QS = [
  { id: 1, q: "Pick one forever", a: "Jollof rice", b: "Fried rice" },
  { id: 2, q: "Morning person or night owl?", a: "Up with the sun", b: "Up till 3am" },
  { id: 3, q: "Texting style", a: "Long paragraphs", b: "Voice notes" },
  { id: 4, q: "Perfect Saturday night?", a: "Owambe till 4am", b: "Netflix and suya" },
  { id: 5, q: "Pets", a: "Dogs", b: "Cats" },
  { id: 6, q: "Afrobeats or Amapiano?", a: "Afrobeats", b: "Amapiano" },
  { id: 7, q: "Pick a drink", a: "Chapman", b: "Zobo" },
  { id: 8, q: "Weekend plan", a: "Stay home", b: "Go out" },
  { id: 9, q: "Calls or texts?", a: "Calls", b: "Texts" },
  { id: 10, q: "Rather visit", a: "The past", b: "The future" },
];

function base(over: Partial<Game>): Game {
  const t = Date.now();
  return {
    id: "g1",
    kind: "c4",
    session_id: "s1",
    match_id: null,
    player_a: "me",
    player_b: "ada",
    me: "a",
    status: "active",
    state: {},
    score_a: 0,
    score_b: 0,
    winner: null,
    ended_by: null,
    ended_reason: null,
    deadline_at: new Date(t + 14_000).toISOString(),
    started_at: new Date(t - 60_000).toISOString(),
    ended_at: null,
    created_at: new Date(t - 70_000).toISOString(),
    server_now: new Date(t).toISOString(),
    mine: {},
    record: { played: 2, won: 1, lost: 1, alike: 80 },
    ...over,
  };
}

function demo(screen: string): Game | null {
  const t = Date.now();
  const at = (s: number) => new Date(t + s * 1000).toISOString();
  switch (screen) {
    case "game-challenge":
      return base({ status: "invited", me: "b", deadline_at: at(24), started_at: null, record: { played: 1, won: 1, lost: 0, alike: null } });
    case "game-vs":
      return base({ started_at: at(2.4), deadline_at: at(22), state: { board: ".".repeat(42), turn: "a", round: 1, wins: { a: 0, b: 0 }, moves: 0 } });
    case "game-c4": {
      const rows = [".......", ".......", "...b...", "..aa...", "..bab..", ".babaa."];
      return base({
        state: { board: rows.join(""), turn: "a", round: 3, wins: { a: 1, b: 1 }, starter: "a", last: 2 * 7 + 3, moves: 11, auto_a: 0, auto_b: 0 },
        score_a: 1,
        score_b: 1,
      });
    }
    case "game-c4-win": {
      const rows = [".......", ".......", "...a...", "..ab...", "..bab..", ".baaab."];
      const line = [2 * 7 + 3, 3 * 7 + 2, 4 * 7 + 1, 5 * 7 + 0];
      const board = rows.join("").split("");
      board[5 * 7 + 0] = "a";
      board[4 * 7 + 1] = "a";
      return base({
        state: {
          board: ".".repeat(42),
          turn: "b",
          round: 3,
          wins: { a: 2, b: 1 },
          last: null,
          moves: 0,
          prev: { board: board.join(""), line, winner: "a", round: 2 },
          pause_until: at(30),
        },
      });
    }
    case "game-tot":
      return base({
        kind: "tot",
        deadline_at: at(5),
        state: { qs: QS, i: 3, picks: [["a", "a"], ["b", "a"], ["a", "a"]], alike: 2 },
        mine: {},
      });
    case "game-tot-same":
      return base({
        kind: "tot",
        deadline_at: at(10),
        state: { qs: QS, i: 4, picks: [["a", "a"], ["b", "b"], ["a", "a"], ["a", "a"]], alike: 4, reveal_until: at(30) },
      });
    case "game-truths-write":
      return base({
        kind: "truths",
        deadline_at: at(58),
        state: { phase: "write", ready_b: false },
        mine: {
          draft: {
            lines: ["I've been on stage with Burna Boy", "I can't swim, at all", ""],
            lie: 1,
            saved: [
              { id: 1, body: "I've been on stage with Burna Boy", uses: 3 },
              { id: 2, body: "I was born in Kano", uses: 2 },
              { id: 3, body: "I've never eaten amala", uses: 1 },
              { id: 4, body: "I won a dance competition in JSS2", uses: 1 },
            ],
          },
        },
      });
    case "game-truths-guess":
      return base({
        kind: "truths",
        deadline_at: at(31),
        state: {
          phase: "guess",
          lines_b: ["I once ate 3 plates of jollof at a wedding", "I have a twin brother", "I learnt to code from YouTube"],
          guessed_b: false,
        },
        mine: { guess: 1 },
      });
    case "game-truths-reveal":
      return base({
        kind: "truths",
        status: "done",
        ended_at: at(-1),
        deadline_at: null,
        winner: "me",
        score_a: 1,
        state: {
          phase: "reveal",
          lines_a: ["I speak French", "I hate rice", "I met Davido"],
          lines_b: ["I once ate 3 plates of jollof at a wedding", "I have a twin brother", "I learnt to code from YouTube"],
          lie_a: 2,
          lie_b: 1,
          guess_a: 1,
          guess_b: 0,
        },
      });
    case "game-whot":
      return base({
        kind: "whot",
        state: { top: "circle:7", called: null, turn: "a", count_a: 6, count_b: 4, market: 33, last: { by: "b", card: "circle:7", note: "" }, moves: 9 },
        mine: { hand: ["circle:2", "star:7", "whot:20", "square:11", "triangle:4", "cross:13"] },
      });
    case "game-checkers": {
      const rows = [".b.b.b.b", "b.b...b.", ".....b.b", "..b.....", ".a...a..", "a...a...", ".a.a.a.a", "a.A.a.a."];
      return base({
        kind: "checkers",
        state: { board: rows.join(""), turn: "a", chain: null, quiet: 3, captured: { a: 2, b: 1 }, last: { from: 19, to: 26, took: [] }, moves: 14 },
      });
    }
    case "game-chess":
      return base({
        kind: "chess",
        state: {
          fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
          turn: "a",
          san: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"],
          last: { from: "g8", to: "f6", san: "Nf6" },
          check: false,
          taken: { a: "", b: "" },
          moves: 6,
        },
      });
    case "game-ayo":
      return base({
        kind: "ayo",
        state: { pits: [5, 0, 7, 3, 1, 6, 2, 4, 0, 5, 1, 3], store: { a: 6, b: 5 }, turn: "a", last: { pit: 9, end: 2, captured: [] }, moves: 12 },
      });
    case "game-words":
      return base({
        kind: "words",
        deadline_at: at(47),
        score_a: 2400,
        score_b: 1800,
        state: { board: "SRTAVIBEAREBNEST", count_a: 6, count_b: 7 },
        mine: { words: ["BEAR", "RATE", "BRAVEST", "TEAR", "STAR", "NEST"], demo_path: [4, 5, 6, 7] },
      });
    case "game-results":
      return base({ status: "done", ended_at: at(-30), deadline_at: null, winner: "me", score_a: 2, score_b: 1, record: { played: 3, won: 2, lost: 1, alike: 80 } });
    case "game-results-tot":
      return base({ kind: "tot", status: "done", ended_at: at(-30), deadline_at: null, score_a: 8, score_b: 8, state: { qs: QS, alike: 8, picks: [] }, record: { played: 1, won: 0, lost: 0, alike: 80 } });
    default:
      return null;
  }
}

export function GameDemo({ screen }: { screen: string }) {
  const game = useMemo(() => demo(screen), [screen]);
  if (screen === "game-launcher") {
    return (
      <div className="min-h-dvh bg-cream">
        <GameLauncher open onClose={() => {}} them="Golden Owl" masked record={{ played: 1, won: 1, lost: 0 }} onPick={async () => null} />
      </div>
    );
  }
  if (!game) return null;
  return (
    <GameArena
      game={game}
      names={names}
      act={act}
      onMinimize={() => {}}
      onClose={() => {}}
      peek={screen === "game-c4" ? "you're not winning this one 😤" : null}
      unmask={{ onUnmask: () => {}, done: false }}
    />
  );
}
