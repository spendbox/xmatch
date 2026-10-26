"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameArena } from "@/components/games/GameArena";
import { GameLauncher } from "@/components/games/GameLauncher";
import type { Game, GameActions } from "@/lib/games";
import * as bomb from "@/lib/boardgames/bomb";
import * as gems from "@/lib/boardgames/gems";
import { MoveError } from "@/lib/boardgames/types";

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
  // New board games and the pop-ups (game-ludo, game-ludo-six, game-snakes-ladder, game-whot-pick2 …)
  const [, kind, popName] = screen.match(/^game-(ludo|snakes|whot)(?:-(\w+))?$/) ?? [];
  if (kind === "ludo")
    return base({
      kind: "ludo",
      state: { demo: true, demo_pop: popName, tokens: { a: [-1, 7, 20, 56], b: [-1, -1, 31, 12] }, turn: "a", roll: null, moves: 6, last: null },
    });
  if (kind === "snakes") return base({ kind: "snakes", state: { demo: true, demo_pop: popName, pos: { a: 58, b: 47 }, turn: "a", moves: 8, last: null } });
  if (kind === "whot" && popName)
    return base({
      kind: "whot",
      state: { demo_pop: popName, top: "circle:7", called: null, turn: "a", count_a: 6, count_b: 4, market: 33, last: { by: "b", card: "circle:7", note: "" }, moves: 9 },
      mine: { hand: ["circle:2", "star:7", "whot:20", "square:11", "triangle:4", "cross:13"] },
    });
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
            things: ["My comfort food is jollof rice", "On repeat right now: Asake", "My football team: Arsenal", "I'm secretly good at cooking"],
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
    case "game-bomb-hide":
      return base({ kind: "bomb", state: bombStart() });
    case "game-bomb":
      return base({
        kind: "bomb",
        mine: { bombs: [0, 4, 8] },
        state: {
          ...bombStart(),
          phase: "play",
          ready_a: true,
          ready_b: true,
          turn: "a",
          open_b: "s..x.s...",
          open_a: "x...s..s.",
          boom_a: 1,
          boom_b: 1,
          last: { by: "b", cell: 7, bomb: false },
          moves: 7,
        },
      });
    case "game-bomb-round":
      return base({
        kind: "bomb",
        state: {
          ...bombStart(),
          round: 2,
          wins: { a: 1, b: 0 },
          starter: "b",
          ready_b: true,
          result: { round: 1, winner: "a", why: "clear", bombs: { a: [0, 4, 8], b: [1, 3, 7] }, open: { a: "x.s.x..s.", b: "sx.xs.s.s" } },
          moves: 12,
        },
      });
    case "game-gems": {
      const board = gems.freshBoard();
      board[17] = "bh";
      board[18] = "rv";
      board[31] = "*";
      board[38] = "gx";
      return base({ kind: "gems", state: { board, turn: "a", left: 2, done: { a: 2, b: 2 }, points: { a: 1240, b: 980 }, last: null, moves: 8 } });
    }
    default:
      return null;
  }
}

function bombStart(): bomb.BombState {
  return {
    phase: "hide",
    round: 1,
    wins: { a: 0, b: 0 },
    starter: "a",
    ready_a: false,
    ready_b: false,
    turn: null,
    open_a: ".........",
    open_b: ".........",
    boom_a: 0,
    boom_b: 0,
    last: null,
    result: null,
    moves: 0,
  };
}

/** Bombshell and Gem Clash previews you can actually play, against a simple bot */
function useLocalGame(initial: Game | null) {
  const [game, setGame] = useState(initial);
  const ref = useRef(game);
  ref.current = game;
  const secrets = useRef<Record<"a" | "b", number[]>>({ a: (initial?.mine?.bombs as number[]) ?? [], b: [1, 3, 7] });

  function apply(side: "a" | "b", mv: unknown): string | null {
    const g = ref.current;
    if (!g) return null;
    try {
      const r =
        g.kind === "gems"
          ? gems.applyMove(g.state as gems.GemsState, side, mv as gems.GemsMove)
          : bomb.applyMove(g.state as bomb.BombState, side, mv as bomb.BombMove, secrets.current);
      if (r.secrets) for (const s of ["a", "b"] as const) if (r.secrets[s]) secrets.current[s] = (r.secrets[s] as bomb.BombSecret).bombs;
      const next: Game = { ...g, state: r.state, mine: { bombs: secrets.current.a } };
      if (r.over) Object.assign(next, { status: "done", ended_at: new Date().toISOString(), score_a: r.over.score_a, score_b: r.over.score_b, winner: r.over.winner === "a" ? "me" : r.over.winner ? "ada" : null });
      ref.current = next;
      setGame(next);
      return null;
    } catch (e) {
      if (e instanceof MoveError) return e.message;
      throw e;
    }
  }

  // The bot's turn
  const st = game?.state;
  useEffect(() => {
    const g = ref.current;
    if (!g || g.status !== "active" || (g.kind !== "gems" && g.kind !== "bomb")) return;
    const t = setTimeout(() => {
      const s = ref.current!.state;
      if (g.kind === "bomb") {
        const b = s as bomb.BombState;
        if (b.phase === "hide" && !b.ready_b) apply("b", { type: "hide", cells: [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3) });
        else if (b.phase === "play" && b.turn === "b") {
          const free = [...b.open_a].flatMap((c, i) => (c === "." ? [i] : []));
          apply("b", { type: "pick", cell: free[Math.floor(Math.random() * free.length)] });
        }
      } else {
        const gs = s as gems.GemsState;
        if (gs.turn !== "b") return;
        const opts: [number, number][] = [];
        for (let i = 0; i < gems.N; i++) for (const j of [i + 1, i + gems.SIZE]) if (j < gems.N && (j !== i + 1 || i % gems.SIZE < gems.SIZE - 1) && gems.swapWorks(gs.board, i, j)) opts.push([i, j]);
        const [a, b] = opts[Math.floor(Math.random() * opts.length)];
        apply("b", { type: "swap", a, b });
      }
    }, game?.kind === "gems" ? 2600 : 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  const local: GameActions = { ...act, move: async (mv) => apply("a", mv) };
  return { game, act: local };
}

export function GameDemo({ screen }: { screen: string }) {
  const initial = useMemo(() => demo(screen), [screen]);
  const live = useLocalGame(initial);
  const game = live.game;
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
      act={game.kind === "bomb" || game.kind === "gems" ? live.act : act}
      onMinimize={() => {}}
      onClose={() => {}}
      peek={screen === "game-c4" ? "you're not winning this one 😤" : null}
      unmask={{ onUnmask: () => {}, done: false }}
    />
  );
}
