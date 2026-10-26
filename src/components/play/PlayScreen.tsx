"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { buzz, sfx, type GameKind } from "@/lib/games";
import { INTENTS } from "@/lib/constants";
import type { Intent } from "@/lib/types";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GameArt } from "@/components/games/GameLauncher";
import { BigButton } from "@/components/games/parts";
import { usePlayGames } from "./PlayGame";
import { GameArena } from "@/components/games/GameArena";
import { PRACTICE_GAMES, usePracticeGame } from "@/components/games/practice";

export type PlayStatus = {
  waiting: boolean;
  joined_at: string | null;
  game_id: string | null;
  game: GameKind | null;
  intent: Intent;
  seeking: string;
  age_min: number;
  age_max: number;
  cost: number;
  balance: number;
  games: GameKind[];
  in_line: number;
  playing: number;
  server_now: string;
};

const TITLES: Record<string, string> = { whot: "Whot", ayo: "Ayo", ludo: "Ludo", snakes: "Snakes & Ladders" };
const REEL: GameKind[] = ["whot", "ludo", "ayo", "snakes"];
const ROW = 150;

/**
 * Play a stranger: wait in line with people in your mood, get paired, and Dashpad
 * picks the game. Opens the masked chat straight into the game.
 */
export function PlayScreen({ userId, demo }: { userId: string; demo?: { status: PlayStatus; phase?: "idle" | "waiting" | "found"; practice?: GameKind } }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [st, setSt] = useState<PlayStatus | null>(demo?.status ?? null);
  const [phase, setPhase] = useState<"idle" | "waiting" | "found">(demo?.phase ?? "idle");
  const [found, setFound] = useState<{ id: string; game: GameKind } | null>(demo?.phase === "found" ? { id: "demo", game: demo.status.game ?? "ludo" } : null);
  const playGames = usePlayGames();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Set after the page loads, so the server and phone draw the same thing first
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const leaving = useRef(false);
  const [practice, setPractice] = useState<GameKind | null>(demo?.practice ?? null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const load = useCallback(async () => {
    if (demo) return null;
    const { data, error } = await supabase.rpc("play_status");
    const s = data as PlayStatus | null;
    if (s) {
      setSt(s);
      setLoadErr(null);
    } else setLoadErr(error ? "Play isn't ready yet. Try again in a moment." : "Couldn't load Play. Check your connection.");
    return s;
  }, [supabase, demo]);

  // Paired: show the game being picked, then open the chat
  const goFound = useCallback(
    (id: string, game: GameKind) => {
      if (leaving.current) return;
      leaving.current = true;
      // A real player: the practice game closes and the real one opens
      setPractice(null);
      setFound({ id, game });
      setPhase("found");
      sfx("match");
      buzz([30, 60, 30, 60, 90]);
      setTimeout(() => {
        void supabase.rpc("play_leave").then(() => {});
        // The game opens on top of everything; you can minimise it and it keeps going
        playGames.open(id);
        router.push("/home");
      }, 2900);
    },
    [router, supabase, playGames],
  );

  // First look: maybe you're already waiting, or were just paired
  useEffect(() => {
    if (demo) return;
    void load().then((s) => {
      if (!s) return;
      if (s.game_id && s.game) goFound(s.game_id, s.game);
      else if (s.waiting) setPhase("waiting");
    });
  }, [load, demo, goFound]);

  // While waiting: hear the moment someone pairs with you, and keep the count fresh
  useEffect(() => {
    if (demo || phase !== "waiting") return;
    const ch = supabase
      .channel(`play-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "play_queue", filter: `user_id=eq.${userId}` }, (p) => {
        const row = (p.new ?? {}) as { game_id?: string | null; game_kind?: GameKind | null };
        if (row.game_id && row.game_kind) goFound(row.game_id, row.game_kind);
      })
      .subscribe();
    const t = setInterval(async () => {
      const s = await load();
      if (s?.game_id && s.game) goFound(s.game_id, s.game);
      else if (s && !s.waiting) setPhase("idle");
    }, 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
      clearInterval(tick);
    };
  }, [demo, phase, supabase, userId, load, goFound]);

  // Leaving the screen while waiting takes you out of the line
  useEffect(() => {
    if (demo) return;
    const out = () => {
      if (!leaving.current) void supabase.rpc("play_leave").then(() => {});
    };
    window.addEventListener("pagehide", out);
    return () => {
      window.removeEventListener("pagehide", out);
      if (phaseRef.current === "waiting") out();
    };
  }, [demo, supabase]);
  async function play() {
    if (busy || !st) return;
    setErr(null);
    if (st.cost > st.balance) return;
    setBusy(true);
    sfx("tap");
    if (demo) {
      setPhase("waiting");
      setBusy(false);
      setTimeout(() => goFoundDemo(), 3500);
      return;
    }
    const { data, error } = await supabase.rpc("play_join");
    setBusy(false);
    if (error) {
      const m = error.message.replace(/^.*?: /, "");
      setErr(m.includes("NOT_ENOUGH_KEYS") ? "You need more Keys to play." : m);
      void load();
      return;
    }
    const r = data as { game_id: string | null; game: GameKind | null };
    if (r.game_id && r.game) {
      // You found someone waiting: tell them the game's on
      notify({ kind: "play_match", gameId: r.game_id });
      goFound(r.game_id, r.game);
    } else {
      setPhase("waiting");
      void load();
    }
  }
  function goFoundDemo() {
    setFound({ id: "demo", game: "ludo" });
    setPhase("found");
  }

  async function cancel() {
    setPhase("idle");
    if (!demo) {
      await supabase.rpc("play_leave");
      void load();
    }
  }

  // Time in line (corrected for the phone's clock)
  const skew = st ? new Date(st.server_now).getTime() - Date.now() : 0;
  const waitedSec = now && st?.joined_at ? Math.max(0, Math.floor((now + skew - new Date(st.joined_at).getTime()) / 1000)) : 0;
  const short = st ? st.cost > st.balance : false;
  const games = st?.games?.length ? st.games : REEL;

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden text-white lg:min-h-[calc(100dvh)]"
      style={{ background: "radial-gradient(120% 70% at 50% 0%, #1d7a5c 0%, #0c3b2e 55%, #05170f 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(60% 40% at 80% 10%, #f2b33d55, transparent 70%)" }} />
      <header className="relative flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href="/home" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-white/12">
          <ChevronLeft size={22} />
        </Link>
        <p className="min-w-0 flex-1 text-center text-[11px] font-extrabold tracking-[0.16em] text-gold uppercase">Play a stranger</p>
        <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/12 pr-3.5 pl-1.5 text-[14px] font-bold">
          <KeyCoin size={26} /> {st?.balance ?? "…"}
        </span>
      </header>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {phase === "idle" && loadErr && !st && (
          <div className="my-auto rounded-[22px] bg-white/10 p-5 text-center ring-1 ring-white/10">
            <p className="text-[15px] font-semibold">{loadErr}</p>
            <button type="button" onClick={() => void load()} className="mt-4 h-11 rounded-full bg-gold px-6 text-[15px] font-extrabold text-ink">
              Try again
            </button>
          </div>
        )}
        {phase === "idle" && (
          <>
            <h1 className="text-center font-display text-[34px] leading-tight font-bold text-balance">Play someone new</h1>
            <p className="mx-auto mt-2 max-w-[300px] text-center text-[14.5px] text-white/75">
              Dashpad pairs you with someone online who fits your settings, and picks the game. Message them or send a gift while you play.
            </p>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {games.map((g) => (
                <div key={g} className="grid gap-1.5 text-center">
                  <span className="block h-[84px] overflow-hidden rounded-2xl bg-white/10 py-2 ring-1 ring-white/10">
                    <GameArt kind={g} />
                  </span>
                  <span className="text-[11.5px] font-bold text-white/80">{TITLES[g]}</span>
                </div>
              ))}
            </div>

            {/* Who you're paired with: your Masquerade settings */}
            {st && (
              <Link
                href="/home?settings=1"
                className="mt-7 flex items-center gap-3 rounded-[20px] bg-white/10 p-3.5 ring-1 ring-white/10 transition active:scale-[0.98]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-ink">{INTENT_ICONS[st.intent]({ size: 22, strokeWidth: 2 })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-extrabold tracking-[0.12em] text-white/60 uppercase">Your Masquerade settings</span>
                  <span className="block truncate text-[15px] font-bold">
                    {INTENTS.find((m) => m.value === st.intent)?.label} · {seekingLabel(st.seeking)} · {st.age_min}–{st.age_max}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold text-gold">Change</span>
              </Link>
            )}

            <div className="mt-auto pt-8">
              {short ? (
                <>
                  <p className="mb-3 text-center text-[14px] text-white/80">
                    A match costs {st?.cost} {st?.cost === 1 ? "Key" : "Keys"}. You have {st?.balance}.
                  </p>
                  <Link href="/wallet" className="gm-btn gm-gold inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] text-[16px] font-extrabold">
                    <KeyCoin size={24} /> Get Keys
                  </Link>
                </>
              ) : (
                <BigButton onClick={play} disabled={!st || busy} className="w-full">
                  {busy ? "Starting…" : "Find a player"}
                </BigButton>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-white/70">
                {st?.cost ? (
                  <>
                    <KeyCoin size={16} /> {st.cost} {st.cost === 1 ? "Key" : "Keys"} per match · only when you're paired
                  </>
                ) : st ? (
                  "Free to play"
                ) : (
                  "Loading…"
                )}
              </p>
              {(st?.playing ?? 0) > 0 && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#7dffb8]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#7dffb8]" /> {st!.playing} {st!.playing === 1 ? "game" : "games"} on right now
                </p>
              )}
              {err && <p className="mt-3 text-center text-[13.5px] font-semibold text-[#ffb4b4]">{err}</p>}
            </div>
          </>
        )}

        {phase === "waiting" && (
          <div className="flex flex-1 flex-col items-center text-center">
            <div className="relative mt-6 h-[210px] w-[210px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="pl-ring absolute inset-0 rounded-full border-2 border-gold" style={{ animationDelay: `${i * 0.8}s` }} />
              ))}
              <span className="absolute inset-[62px] grid place-items-center rounded-full bg-gold text-ink shadow-[0_10px_40px_-6px_#f2b33d]">
                {st && INTENT_ICONS[st.intent]({ size: 36, strokeWidth: 2 })}
              </span>
            </div>
            <h1 className="font-display text-[30px] leading-tight font-bold">Finding a player</h1>
            <p className="mt-1.5 text-[14.5px] text-white/75">
              Someone who fits your settings · {fmt(waitedSec)}
            </p>
            <div className="mt-6 w-full rounded-[22px] bg-white/8 p-4 text-left ring-1 ring-white/10">
              <p className="text-[14px] font-semibold">
                {st && st.in_line > 0 ? `${st.in_line} more ${st.in_line === 1 ? "person" : "people"} waiting who ${st.in_line === 1 ? "fits" : "fit"} your settings` : "You're first in line"}
              </p>
              <p className="mt-1 text-[13px] text-white/65">
                Keep this screen open. You're paired the moment someone taps Play
                {st?.cost ? `, and ${st.cost} ${st.cost === 1 ? "Key is" : "Keys are"} used then` : ""}.
              </p>
            </div>
            {/* Practice against the computer: you keep your place in line */}
            <button
              type="button"
              onClick={() => {
                sfx("tap");
                const pool = (st?.games?.length ? st.games : PRACTICE_GAMES).filter((g) => PRACTICE_GAMES.includes(g));
                setPractice(pool[Math.floor(Math.random() * pool.length)] ?? "ludo");
              }}
              className="mt-4 flex w-full items-center gap-3 rounded-[22px] bg-gold/15 p-4 text-left ring-1 ring-gold/40 transition active:scale-[0.98]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold text-ink">
                <Bot size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">Practice while you wait</span>
                <span className="block text-[12.5px] text-white/70">Play the computer. Free. You'll jump into a real game the moment someone's found.</span>
              </span>
            </button>
            {waitedSec > 90 && (
              <p className="mt-4 text-[13px] text-white/70">Quiet right now. Evenings are busiest. You can leave and try again later.</p>
            )}
            <div className="mt-auto w-full pt-8">
              <BigButton variant="ghost" onClick={cancel} className="w-full">
                Stop looking
              </BigButton>
            </div>
          </div>
        )}

        {phase === "found" && found && <Picked game={found.game} />}
        {phase === "waiting" && practice && <Practice kind={practice} onClose={() => setPractice(null)} />}
      </main>

      <style>{`
        @keyframes pl-ring { 0% { transform: scale(.35); opacity: .9 } 100% { transform: scale(1); opacity: 0 } }
        .pl-ring { animation: pl-ring 2.4s ease-out infinite; }
        @keyframes pl-in { 0% { transform: scale(.4) rotate(-6deg); opacity: 0 } 60% { transform: scale(1.08) rotate(2deg); opacity: 1 } 100% { transform: none } }
        .pl-in { animation: pl-in .5s cubic-bezier(.2,1.4,.4,1) both; }
        @media (prefers-reduced-motion: reduce) { .pl-ring, .pl-in { animation: none } }
      `}</style>
    </div>
  );
}

/** Player found: a reel spins through the games and stops on the one Dashpad picked */
function Picked({ game }: { game: GameKind }) {
  const list = useMemo(() => Array.from({ length: 5 }, () => REEL).flat(), []);
  const target = 4 * REEL.length + REEL.indexOf(game);
  const [y, setY] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setY(target * ROW), 60);
    const d = setTimeout(() => {
      setDone(true);
      sfx("win");
    }, 2300);
    return () => {
      clearTimeout(t);
      clearTimeout(d);
    };
  }, [target]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <p className="pl-in text-[12px] font-extrabold tracking-[0.18em] text-gold">PLAYER FOUND</p>
      <h1 className="pl-in mt-2 font-display text-[32px] leading-tight font-bold">Game on!</h1>
      <p className="mt-1 text-[14.5px] text-white/75">{done ? "Dashpad picked your game" : "Dashpad is picking your game…"}</p>
      <div
        className="relative mt-8 h-[150px] w-[240px] overflow-hidden rounded-[28px] bg-black/25 ring-2 transition-[box-shadow] duration-300"
        style={{ boxShadow: done ? "0 0 0 3px #f2b33d, 0 0 40px 6px #f2b33d88" : "inset 0 20px 20px -14px #000a, inset 0 -20px 20px -14px #000a", ["--tw-ring-color" as string]: "rgba(255,255,255,0.15)" }}
      >
        <div style={{ transform: `translateY(-${y}px)`, transition: "transform 2.2s cubic-bezier(.15,.85,.25,1)" }}>
          {list.map((g, i) => (
            <div key={i} className="grid h-[150px] place-items-center content-center gap-2">
              <span className="block h-[78px] w-[120px]">
                <GameArt kind={g} />
              </span>
              <span className="font-display text-[20px] font-bold">{TITLES[g]}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 text-[13.5px] text-white/70">{done ? "Opening your game…" : "Get ready"}</p>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** "women,men" → "Women & men"; "anyone" → "Anyone" */
function seekingLabel(s: string) {
  if (!s || s === "anyone") return "Anyone";
  const words: Record<string, string> = { women: "women", men: "men", other: "others" };
  const list = s.split(",").map((x) => words[x] ?? x);
  const text = list.length > 1 ? `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}` : list[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A practice game against the computer, on top of the waiting screen */
function Practice({ kind, onClose }: { kind: GameKind; onClose: () => void }) {
  const { game, act } = usePracticeGame(kind);
  if (!game) return null;
  return (
    <GameArena
      practice
      game={game}
      names={{ me: "You", them: "Computer" }}
      act={act}
      onMinimize={onClose}
      onClose={onClose}
    />
  );
}
