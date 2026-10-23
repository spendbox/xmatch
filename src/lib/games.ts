"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { haptic } from "@/lib/haptics";

export type GameKind = "truths" | "tot" | "c4" | "words";
export type GameStatus = "invited" | "active" | "done" | "declined" | "expired" | "cancelled";
export type Side = "a" | "b";

export type TotQuestion = { id: number; q: string; a: string; b: string };

export type Game = {
  id: string;
  kind: GameKind;
  session_id: string | null;
  match_id: string | null;
  player_a: string;
  player_b: string;
  me: Side;
  status: GameStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>;
  score_a: number;
  score_b: number;
  winner: string | null;
  ended_by: string | null;
  ended_reason: string | null;
  deadline_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  server_now: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mine: Record<string, any>;
  record: { played: number; won: number; lost: number; alike: number | null } | null;
};

export const GAMES: {
  kind: GameKind;
  title: string;
  short: string;
  rules: string[];
  /** Arena background */
  bg: string;
  /** Launcher card */
  card: string;
  edge: string;
}[] = [
  {
    kind: "truths",
    title: "Two Truths & a Lie",
    short: "Spot their lie",
    rules: ["Write 3, one is a lie", "Then guess theirs"],
    bg: "radial-gradient(120% 60% at 50% 0%, #3b2a96 0%, #1a1240 60%, #0b0720 100%)",
    card: "linear-gradient(160deg, #6d4ff0 0%, #3a2896 100%)",
    edge: "#241869",
  },
  {
    kind: "tot",
    title: "This or That",
    short: "How alike are you?",
    rules: ["10 quick picks", "Pick at your own pace"],
    bg: "radial-gradient(120% 60% at 50% 0%, #6b1f47 0%, #2a0f2a 60%, #12071a 100%)",
    card: "linear-gradient(160deg, #c2306b 0%, #7a1d47 100%)",
    edge: "#4f122e",
  },
  {
    kind: "c4",
    title: "Connect 4",
    short: "Four in a row wins",
    rules: ["Best of 3", "Take your time on each move"],
    bg: "radial-gradient(120% 60% at 50% 0%, #1f3a9a 0%, #121a4a 60%, #080b22 100%)",
    card: "linear-gradient(160deg, #2563eb 0%, #1b3a8f 100%)",
    edge: "#11265e",
  },
  {
    kind: "words",
    title: "Word Hunt",
    short: "Most words in 80s",
    rules: ["Same board for both", "80 seconds"],
    bg: "radial-gradient(120% 60% at 50% 0%, #136b4a 0%, #0b3a2a 60%, #05170f 100%)",
    card: "linear-gradient(160deg, #1f9d6b 0%, #0f5c3e 100%)",
    edge: "#0a3a28",
  },
];

export const gameInfo = (k: string | undefined) => GAMES.find((g) => g.kind === k) ?? GAMES[0];

/** Who is who, from my side */
export function sides(g: Pick<Game, "me">) {
  const me = g.me;
  const them: Side = me === "a" ? "b" : "a";
  return { me, them };
}

export function myScore(g: Game) {
  return g.me === "a" ? g.score_a : g.score_b;
}
export function theirScore(g: Game) {
  return g.me === "a" ? g.score_b : g.score_a;
}

// ---------------------------------------------------------------------------
// Sound (off by default) and phone buzz
// ---------------------------------------------------------------------------
const SOUND_KEY = "dp_game_sound";
let soundOn: boolean | null = null;
let ctx: AudioContext | null = null;
const soundListeners = new Set<(on: boolean) => void>();

function readSound() {
  if (soundOn !== null) return soundOn;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    soundOn = false;
  }
  return soundOn;
}

export function useGameSound() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readSound());
    soundListeners.add(setOn);
    return () => {
      soundListeners.delete(setOn);
    };
  }, []);
  const toggle = useCallback(() => {
    const next = !readSound();
    soundOn = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
    soundListeners.forEach((l) => l(next));
    if (next) sfx("tap");
  }, []);
  return { on, toggle };
}

type Sfx = "tap" | "drop" | "win" | "lose" | "tick" | "go" | "match" | "word" | "bad" | "flip";

const NOTES: Record<Sfx, [number, number, OscillatorType, number?][]> = {
  // [frequency, duration seconds, wave, start offset]
  tap: [[660, 0.05, "triangle"]],
  drop: [[220, 0.09, "sine"], [140, 0.08, "sine", 0.06]],
  tick: [[880, 0.04, "square"]],
  go: [[523, 0.1, "triangle"], [784, 0.16, "triangle", 0.1]],
  flip: [[440, 0.06, "triangle"], [660, 0.06, "triangle", 0.05]],
  match: [[659, 0.08, "triangle"], [880, 0.08, "triangle", 0.08], [1175, 0.14, "triangle", 0.16]],
  word: [[784, 0.06, "triangle"], [1047, 0.1, "triangle", 0.06]],
  bad: [[180, 0.12, "sawtooth"]],
  win: [[523, 0.1, "triangle"], [659, 0.1, "triangle", 0.1], [784, 0.1, "triangle", 0.2], [1047, 0.3, "triangle", 0.3]],
  lose: [[392, 0.14, "triangle"], [330, 0.14, "triangle", 0.14], [262, 0.3, "triangle", 0.28]],
};

/** Play a short sound effect (only if sound is on) */
export function sfx(name: Sfx) {
  if (!readSound() || typeof window === "undefined") return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, d, type, at = 0] of NOTES[name]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + d + 0.02);
    }
  } catch {
    /* no audio */
  }
}

/** Buzz the phone */
export function buzz(pattern: number | number[] = 10) {
  haptic(pattern);
}

// ---------------------------------------------------------------------------
// Word Hunt dictionary: downloaded once, then kept by the browser
// ---------------------------------------------------------------------------
let dict: Promise<Set<string>> | null = null;
export function loadWords() {
  dict ??= fetch("/games/words.txt", { cache: "force-cache" })
    .then((r) => r.text())
    .then((t) => {
      const out = new Set<string>();
      let prev = "";
      for (const line of t.split("\n")) {
        if (!line) continue;
        const m = /^(\d+)(.*)$/.exec(line);
        if (!m) continue;
        const w = prev.slice(0, Number(m[1])) + m[2];
        out.add(w);
        prev = w;
      }
      return out;
    })
    .catch((e) => {
      dict = null;
      throw e;
    });
  return dict;
}

export function wordPoints(n: number) {
  if (n <= 2) return 0;
  if (n === 3) return 100;
  if (n === 4) return 400;
  if (n === 5) return 800;
  return 1400 + (n - 6) * 400;
}

// ---------------------------------------------------------------------------
// The live game in a chat
// ---------------------------------------------------------------------------
export type GameActions = {
  start: (kind: GameKind, rematch?: string) => Promise<string | null>;
  respond: (accept: boolean) => Promise<string | null>;
  cancel: () => Promise<void>;
  call: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: string | null }>;
  refresh: () => Promise<void>;
  /** Server time, in ms */
  now: () => number;
};

export function useChatGame({
  sessionId = null,
  matchId = null,
  disabled = false,
}: {
  sessionId?: string | null;
  matchId?: string | null;
  disabled?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState<Game | null>(null);
  const offset = useRef(0);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  const take = useCallback((g: Game | null) => {
    if (g?.server_now) offset.current = new Date(g.server_now).getTime() - Date.now();
    setGame((cur) => {
      if (!g) return cur && (cur.status === "invited" || cur.status === "active") ? null : cur;
      return g;
    });
  }, []);

  const load = useCallback(async () => {
    if (disabled) return;
    const { data } = await supabase.rpc("chat_game", { p_session: sessionId, p_match: matchId });
    take((data as Game | null) ?? null);
  }, [supabase, sessionId, matchId, disabled, take]);

  const loadOne = useCallback(
    async (id: string) => {
      const { data } = await supabase.rpc("get_game", { p_game: id });
      if (data) take(data as Game);
    },
    [supabase, take],
  );

  // First load, then live changes
  useEffect(() => {
    if (disabled) return;
    void load();
    const filter = sessionId ? `session_id=eq.${sessionId}` : `match_id=eq.${matchId}`;
    const ch = supabase
      .channel(`games-${sessionId ?? matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter }, (p) => {
        const row = (p.new ?? {}) as { id?: string };
        if (row.id) void loadOne(row.id);
      })
      .subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [supabase, sessionId, matchId, disabled, load, loadOne]);

  const now = useCallback(() => Date.now() + offset.current, []);

  const gid = game?.id;
  const live = game?.status === "invited" || game?.status === "active";
  const deadline = game?.deadline_at ?? null;

  // When a timer runs out, nudge the server (both phones do this; the server only acts once)
  useEffect(() => {
    if (!gid || !live || !deadline) return;
    const due = new Date(deadline).getTime();
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const fire = async () => {
      if (stop) return;
      await supabase.rpc("game_tick", { p_game: gid });
      await loadOne(gid);
      if (!stop) t = setTimeout(fire, 1500);
    };
    t = setTimeout(fire, Math.max(0, due - now()) + 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [gid, live, deadline, supabase, loadOne, now]);

  // Safety net while a game is on: re-check every few seconds in case a live update was missed
  useEffect(() => {
    if (!gid || !live) return;
    const t = setInterval(() => void loadOne(gid), 6000);
    return () => clearInterval(t);
  }, [gid, live, loadOne]);

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn, args);
      const id = gameRef.current?.id;
      if (id) void loadOne(id);
      return { data, error: error ? cleanError(error.message) : null };
    },
    [supabase, loadOne],
  );

  const actions: GameActions = {
    start: async (kind, rematch) => {
      const { data, error } = await supabase.rpc("start_game", {
        p_kind: kind,
        p_session: sessionId,
        p_match: matchId,
        p_rematch: rematch ?? null,
      });
      if (error) return cleanError(error.message);
      if (data) {
        await loadOne(data as string);
        // The server only sends it if the challenge is still waiting
        notify({ kind: "game_invite", gameId: data as string });
      }
      return null;
    },
    respond: async (accept) => {
      const g = gameRef.current;
      if (!g) return null;
      const { error } = await supabase.rpc("respond_game", { p_game: g.id, p_accept: accept });
      await loadOne(g.id);
      return error ? cleanError(error.message) : null;
    },
    cancel: async () => {
      const g = gameRef.current;
      if (!g) return;
      await supabase.rpc("cancel_game", { p_game: g.id });
      await loadOne(g.id);
    },
    call,
    refresh: load,
    now,
  };

  const clear = useCallback(() => setGame(null), []);
  return { game, actions, clear };
}

export function cleanError(m: string) {
  if (/function .* does not exist|schema cache/i.test(m)) return "Games are almost here. Try again soon.";
  return m.replace(/^.*?ERROR:\s*/, "");
}
