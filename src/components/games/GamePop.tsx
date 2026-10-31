"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { buzz, sfx } from "@/lib/games";
import { Confetti } from "./parts";

/** good: your big move · bad: a hit against you · move: a game moment · win: the end */
export type PopTone = "good" | "bad" | "move" | "win";
export type Pop = {
  id: number;
  title: string;
  sub?: string;
  tone: PopTone;
  art?: React.ReactNode;
  /** A good moment to send a gift: the game screen offers it with this line */
  gift?: string;
};

/** Heard by the game screen: offer a gift */
export const GIFT_EVENT = "dp:game-gift";

const TONES: Record<PopTone, { a: string; b: string; ink: string; ribbon: string }> = {
  good: { a: "#fff1b8", b: "#f2b33d", ink: "#5a3200", ribbon: "#e08a12" },
  bad: { a: "#ffd0d0", b: "#ff4d5e", ink: "#4a0410", ribbon: "#d42a44" },
  move: { a: "#efe6ff", b: "#a78bfa", ink: "#22105e", ribbon: "#6d4ff0" },
  win: { a: "#fff6c9", b: "#f2b33d", ink: "#3a1a00", ribbon: "#6d4ff0" },
};

/** Show a pop-up for ~1.6s. Returns the current pop and a way to show one. */
export function usePops() {
  const [pop, setPop] = useState<Pop | null>(null);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), pop.tone === "win" ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [pop]);
  return {
    pop,
    show: (p: Omit<Pop, "id">) => {
      setPop({ ...p, id: Date.now() + Math.random() });
      if (p.tone === "bad") buzz([30, 50, 60]);
      else buzz(p.tone === "win" ? [20, 40, 20, 40, 60] : [15, 30, 15]);
      sfx(p.tone === "bad" ? "lose" : p.tone === "win" ? "win" : "go");
      if (p.gift) {
        const line = p.gift;
        // After the pop-up has had its moment
        setTimeout(() => window.dispatchEvent(new CustomEvent(GIFT_EVENT, { detail: line })), p.tone === "win" ? 2400 : 1600);
      }
    },
  };
}

/** The big game pop-up: a starburst, chunky 3D title and a ribbon. Sits over the board, never blocks taps. */
/** `big`: the full-screen board games, which get a bigger pop-up on computers */
export function GamePop({ pop, big }: { pop: Pop | null; big?: boolean }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.3;
        const d = 120 + ((i * 37) % 60);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 10 + ((i * 7) % 10), delay: (i % 4) * 0.03 };
      }),
    [],
  );
  if (!pop) return null;
  const t = TONES[pop.tone];
  return (
    <div key={pop.id} aria-live="assertive" className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-hidden">
      {/* Screen flash: a red edge for a hit, a warm glow otherwise */}
      <div
        aria-hidden
        className="gm-pop-flash absolute inset-0"
        style={{
          background:
            pop.tone === "bad"
              ? "radial-gradient(circle at 50% 50%, transparent 35%, rgba(255,40,70,0.55) 100%)"
              : `radial-gradient(circle at 50% 46%, ${t.b}55 0%, transparent 60%)`,
        }}
      />
      {pop.tone === "win" && <Confetti count={48} />}
      <div className={pop.tone === "bad" ? "gm-pop-shake relative grid justify-items-center" : "relative grid justify-items-center"}>
        {/* Rays and starburst */}
        <div
          aria-hidden
          className={`gm-pop-rays absolute top-1/2 left-1/2 h-[420px] w-[420px] rounded-full ${big ? "lg:h-[640px] lg:w-[640px]" : ""}`}
          style={{
            background: `repeating-conic-gradient(from 0deg, ${t.b}66 0deg 9deg, transparent 9deg 24deg)`,
            maskImage: "radial-gradient(circle, #000 18%, transparent 66%)",
            WebkitMaskImage: "radial-gradient(circle, #000 18%, transparent 66%)",
          }}
        />
        <svg aria-hidden viewBox="-100 -100 200 200" className={`gm-pop-burst absolute top-1/2 left-1/2 h-[250px] w-[250px] ${big ? "lg:h-[380px] lg:w-[380px]" : ""}`}>
          <defs>
            <radialGradient id={`pb-${pop.id}`}>
              <stop offset="0" stopColor={t.a} />
              <stop offset="1" stopColor={t.b} />
            </radialGradient>
          </defs>
          <polygon
            points={Array.from({ length: 32 }, (_, i) => {
              const r = i % 2 ? 66 : 96;
              const a = (i / 32) * Math.PI * 2;
              return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
            }).join(" ")}
            fill={`url(#pb-${pop.id})`}
            stroke="#fff"
            strokeWidth="4"
            strokeLinejoin="round"
            opacity="0.95"
          />
        </svg>
        {/* Little bursts flying out */}
        {sparks.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="gm-pop-spark absolute top-1/2 left-1/2"
            style={{ "--sx": `${s.x}px`, "--sy": `${s.y}px`, animationDelay: `${0.12 + s.delay}s` } as React.CSSProperties}
          >
            <svg width={s.s} height={s.s} viewBox="0 0 24 24">
              <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z" fill={i % 3 ? "#fff" : t.a} />
            </svg>
          </span>
        ))}

        {(pop.art ?? (pop.tone === "win" ? <CrownArt /> : null)) && (
          <div className={`gm-pop-art relative mb-1 drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)] ${big ? "lg:mb-3 lg:scale-125" : ""}`}>{pop.art ?? <CrownArt />}</div>
        )}

        {/* Chunky 3D title: a dark extruded copy behind a gradient face */}
        <p className={`gm-pop-title relative -rotate-3 text-center font-display text-[42px] leading-[0.95] font-black tracking-tight whitespace-nowrap uppercase italic min-[400px]:text-[48px] ${big ? "lg:text-[84px]" : ""}`}>
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              color: t.ink,
              WebkitTextStroke: `10px ${t.ink}`,
              textShadow: `0 3px 0 ${t.ink}, 0 6px 0 ${t.ink}, 0 9px 0 ${t.ink}, 0 16px 26px rgba(0,0,0,0.6)`,
            }}
          >
            {pop.title}
          </span>
          <span
            className="relative"
            style={{
              background: `linear-gradient(180deg, #ffffff 0%, ${t.a} 38%, ${t.b} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextStroke: "1.5px rgba(255,255,255,0.6)",
            }}
          >
            {pop.title}
          </span>
        </p>

        {pop.sub && (
          <p
            className={`gm-pop-ribbon relative mt-3 -rotate-2 px-7 py-1.5 text-center text-[14px] font-extrabold text-white ${big ? "lg:text-[20px]" : ""}`}
            style={{
              background: `linear-gradient(180deg, ${t.ribbon}, color-mix(in srgb, ${t.ribbon} 70%, #000))`,
              clipPath: "polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%)",
              textShadow: "0 2px 0 rgba(0,0,0,0.35)",
            }}
          >
            {pop.sub}
          </p>
        )}
      </div>
    </div>
  );
}

/** A big dice face for pop-up art */
export function DiceArt({ n, size = 92 }: { n: number; size?: number }) {
  return (
    <span className="gm-dice-face block" style={{ width: size, height: size }}>
      <DiceFace n={n} />
    </span>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** A dice face drawn in SVG: ivory with rounded corners and sunk pips */
export function DiceFace({ n, red }: { n: number; red?: boolean }) {
  // Own ids: a hidden copy of the dice elsewhere on the page mustn't own the colours
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-label={`Dice shows ${n}`}>
      <defs>
        <linearGradient id={`db${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7defa" />
        </linearGradient>
        <radialGradient id={`dp${id}`} cx="40%" cy="35%">
          <stop offset="0" stopColor="#4a3a7a" />
          <stop offset="1" stopColor="#140d33" />
        </radialGradient>
        <radialGradient id={`dr${id}`} cx="40%" cy="35%">
          <stop offset="0" stopColor="#ff7a84" />
          <stop offset="1" stopColor="#b3122a" />
        </radialGradient>
      </defs>
      <rect x="4" y="8" width="92" height="88" rx="22" fill="#b9aed6" />
      <rect x="4" y="2" width="92" height="88" rx="22" fill={`url(#db${id})`} />
      <rect x="10" y="6" width="80" height="20" rx="10" fill="#fff" opacity="0.7" />
      {PIPS[n]?.map((i) => (
        <circle key={i} cx={24 + (i % 3) * 26} cy={20 + Math.floor(i / 3) * 26} r="8.5" fill={red || n === 6 ? `url(#dr${id})` : `url(#dp${id})`} />
      ))}
    </svg>
  );
}

/** A gold crown for wins */
function CrownArt() {
  return (
    <svg width="110" height="92" viewBox="0 0 110 92" aria-hidden>
      <defs>
        <linearGradient id="crown-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor="#f2b33d" />
          <stop offset="1" stopColor="#c27a12" />
        </linearGradient>
      </defs>
      <path d="M12 74 6 22l26 22L55 8l23 36 26-22-6 52Z" fill="url(#crown-g)" stroke="#7a4a00" strokeWidth="5" strokeLinejoin="round" />
      <rect x="12" y="70" width="86" height="16" rx="6" fill="#c27a12" stroke="#7a4a00" strokeWidth="5" />
      <circle cx="55" cy="50" r="8" fill="#ff4d5e" stroke="#7a4a00" strokeWidth="3" />
      <circle cx="30" cy="58" r="5" fill="#7c5cf0" stroke="#7a4a00" strokeWidth="2.5" />
      <circle cx="80" cy="58" r="5" fill="#2bb39f" stroke="#7a4a00" strokeWidth="2.5" />
      <circle cx="6" cy="20" r="6" fill="#fff3b0" stroke="#7a4a00" strokeWidth="3" />
      <circle cx="55" cy="7" r="6" fill="#fff3b0" stroke="#7a4a00" strokeWidth="3" />
      <circle cx="104" cy="20" r="6" fill="#fff3b0" stroke="#7a4a00" strokeWidth="3" />
    </svg>
  );
}
