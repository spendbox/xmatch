"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, loadWords, sfx, wordPoints, type Game, type GameActions } from "@/lib/games";
import { Spinner } from "@/components/ui/Button";
import { secondsLeft, useTicker, type Names } from "./parts";

const TOTAL = 80;

export function WordHunt({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(250);
  const st = game.state;
  const board: string = st.board ?? "";
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [dictError, setDictError] = useState(false);
  const [path, setPath] = useState<number[]>(game.mine?.demo_path ?? []);
  const [found, setFound] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ text: string; tone: "good" | "bad" | "old"; key: number } | null>(null);
  const [shake, setShake] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const left = game.status === "active" ? secondsLeft(game.deadline_at, act.now) : 0;
  const started = secondsLeft(game.started_at, act.now) <= 0;
  const playing = game.status === "active" && started && left > 0;
  const serverWords: string[] = game.mine?.words ?? [];
  const myWords = Array.from(new Set([...serverWords, ...found]));
  const myScore = me === "a" ? game.score_a : game.score_b;
  const theirScore = me === "a" ? game.score_b : game.score_a;
  const theirCount: number = st[`count_${them}`] ?? 0;

  useEffect(() => {
    loadWords()
      .then(setDict)
      .catch(() => setDictError(true));
  }, []);

  const word = path.map((i) => board[i]).join("");
  const isWord = word.length >= 3 && !!dict?.has(word.toLowerCase());
  const already = myWords.includes(word);

  function cellAt(x: number, y: number) {
    const el = grid.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const size = r.width / 4;
    const c = Math.floor((x - r.left) / size);
    const row = Math.floor((y - r.top) / size);
    if (c < 0 || c > 3 || row < 0 || row > 3) return -1;
    // Only count the middle of a tile, so diagonals are easy
    const cx = r.left + (c + 0.5) * size;
    const cy = r.top + (row + 0.5) * size;
    if (Math.hypot(x - cx, y - cy) > size * 0.42) return -1;
    return row * 4 + c;
  }

  function touches(a: number, b: number) {
    return Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) <= 1 && Math.abs((a % 4) - (b % 4)) <= 1;
  }

  function extend(i: number) {
    if (i < 0) return;
    setPath((p) => {
      if (p.length && p[p.length - 1] === i) return p;
      // Slide back to undo the last letter
      if (p.length >= 2 && p[p.length - 2] === i) {
        sfx("tick");
        return p.slice(0, -1);
      }
      if (p.includes(i) || (p.length && !touches(p[p.length - 1], i))) return p;
      sfx("tick");
      buzz(5);
      return [...p, i];
    });
  }

  function down(e: React.PointerEvent) {
    if (!playing) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragging.current = true;
    setPath([]);
    extend(cellAt(e.clientX, e.clientY));
  }
  function move(e: React.PointerEvent) {
    if (!dragging.current) return;
    extend(cellAt(e.clientX, e.clientY));
  }
  async function up() {
    if (!dragging.current) return;
    dragging.current = false;
    const p = path;
    const w = word;
    setPath([]);
    if (w.length < 3) return;
    const key = Date.now();
    if (myWords.includes(w)) {
      setFlash({ text: `${w} · already found`, tone: "old", key });
      sfx("bad");
      return;
    }
    if (!dict?.has(w.toLowerCase())) {
      setFlash({ text: `${w} · not a word`, tone: "bad", key });
      setShake((n) => n + 1);
      sfx("bad");
      buzz(40);
      return;
    }
    setFound((f) => [...f, w]);
    setFlash({ text: `${w} +${wordPoints(w.length).toLocaleString()}`, tone: "good", key });
    sfx("word");
    buzz(w.length >= 5 ? [15, 30, 15] : 15);
    const { error } = await act.call("submit_word", { p_game: game.id, p_word: w, p_path: p });
    if (error && !/Already/.test(error)) {
      setFound((f) => f.filter((x) => x !== w));
      setFlash({ text: error, tone: "bad", key: Date.now() });
    }
  }

  // Polyline across the tiles you've swiped
  const pts = path.map((i) => `${(i % 4) * 25 + 12.5},${Math.floor(i / 4) * 25 + 12.5}`).join(" ");
  const pct = Math.max(0, Math.min(100, (left / TOTAL) * 100));

  return (
    <div className="flex h-full flex-col px-[18px] pt-2 pb-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-gold">YOU</p>
          <p className="font-display text-[34px] leading-none font-bold tabular-nums">{myScore.toLocaleString()}</p>
          <p className="text-[12px] text-white/65">
            {myWords.length} {myWords.length === 1 ? "word" : "words"}
          </p>
        </div>
        <div
          className={clsx("grid h-[74px] w-[74px] place-items-center rounded-full", left <= 10 && playing && "gm-pulse")}
          style={{ background: `conic-gradient(${left <= 10 ? "#ff6b6b" : "#f2b33d"} 0 ${pct}%, rgba(255,255,255,0.12) ${pct}% 100%)` }}
        >
          <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-[#0b3a2a] text-[18px] font-extrabold tabular-nums">
            {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, "0")}
          </span>
        </div>
        <div className="text-right">
          <p className="max-w-[110px] truncate text-[11px] font-extrabold tracking-[0.1em] text-white/60 uppercase">{names.them}</p>
          <p className="font-display text-[24px] leading-[1.1] font-bold text-[#c4b5fd] tabular-nums">{theirScore.toLocaleString()}</p>
          <p className="text-[12px] text-white/65">
            {theirCount} {theirCount === 1 ? "word" : "words"}
          </p>
        </div>
      </div>

      {/* Current word */}
      <div className="mt-5 flex h-12 items-center justify-center">
        {word ? (
          <span
            className={clsx(
              "rounded-2xl px-4 py-2 text-[22px] font-extrabold tracking-[0.12em] shadow-[0_5px_0_rgba(0,0,0,0.25)]",
              already ? "bg-gold text-ink" : isWord ? "bg-white text-[#0b3a2a]" : "bg-white/85 text-[#0b3a2a]/70",
            )}
          >
            {word}
            {isWord && !already && <span className="ml-1.5 text-[14px] tracking-normal text-mint">+{wordPoints(word.length)}</span>}
          </span>
        ) : flash ? (
          <span
            key={flash.key}
            className={clsx(
              "gm-float-up rounded-2xl px-4 py-2 text-[18px] font-extrabold tracking-[0.06em]",
              flash.tone === "good" ? "bg-[#7dffb5] text-[#0b3a2a]" : flash.tone === "old" ? "bg-gold text-ink" : "bg-[#ff9c9c] text-[#5a1010]",
            )}
          >
            {flash.text}
          </span>
        ) : null}
      </div>

      {/* Board */}
      <div
        key={shake}
        className={clsx("relative mt-4 rounded-[28px] p-3.5", shake > 0 && "gm-shake")}
        style={{ background: "linear-gradient(180deg, #1f9d6b 0%, #137a52 100%)", boxShadow: "0 10px 0 #0a4a32, 0 30px 60px -20px rgba(31,157,107,0.7)" }}
      >
        <div
          ref={grid}
          className="relative grid touch-none grid-cols-4"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={() => dragging.current && up()}
        >
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden>
            {path.length > 1 && (
              <polyline
                points={pts}
                fill="none"
                stroke={already ? "#f2b33d" : isWord ? "#ffffff" : "rgba(255,255,255,0.75)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
            )}
          </svg>
          {board.split("").map((ch, i) => {
            const on = path.includes(i);
            return (
              <div key={i} className="p-[5px]">
                <span
                  className={clsx(
                    "grid aspect-square place-items-center rounded-[18px] text-[32px] font-extrabold",
                    on ? "bg-gold text-ink" : "bg-[#fdfbf6] text-[#0b3a2a]",
                  )}
                  style={{ boxShadow: on ? "0 6px 0 #b9831e, 0 0 0 3px #ffffff" : "0 6px 0 #c9c1b2" }}
                >
                  {/* Letters sit above the swipe line */}
                  <span className="relative z-20">{ch}</span>
                </span>
              </div>
            );
          })}
        </div>
        {(!dict || !started) && game.status === "active" && (
          <div className="absolute inset-0 grid place-items-center rounded-[28px] bg-[#0b3a2a]/70 text-[14px] font-semibold">
            {dictError ? (
              <button type="button" onClick={() => { setDictError(false); loadWords().then(setDict).catch(() => setDictError(true)); }} className="rounded-xl bg-white/15 px-4 py-2">
                Couldn&apos;t load words. Tap to retry
              </button>
            ) : !dict ? (
              <span className="flex items-center gap-2">
                <Spinner /> Getting the words ready…
              </span>
            ) : null}
          </div>
        )}
      </div>

      <p className="mt-5 text-[12px] font-extrabold tracking-[0.12em] text-white/60">YOUR WORDS</p>
      <div className="mt-2 flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto">
        {myWords.length === 0 && <span className="text-[13px] text-white/50">Swipe across touching letters. 3 letters or more.</span>}
        {[...myWords].reverse().map((w) => (
          <span
            key={w}
            className={clsx(
              "rounded-[10px] px-2.5 py-1.5 text-[13px] font-bold",
              w.length >= 6 ? "bg-gold/25 text-[#ffd36b]" : "bg-white/12",
            )}
          >
            {w}
          </span>
        ))}
      </div>
      <p className="mt-auto pt-3 text-center text-[12px] text-white/55">Same board for both of you. Longer words score more.</p>
    </div>
  );
}
