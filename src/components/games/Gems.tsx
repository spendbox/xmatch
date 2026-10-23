"use client";

import clsx from "clsx";
import { colorOf, kindOf } from "@/lib/boardgames/gems";

// Each colour has its own shape too, so they're easy to tell apart
const SHAPES: Record<string, string> = {
  r: "M50 7 L87 28.5 L87 71.5 L50 93 L13 71.5 L13 28.5 Z",
  y: "M50 9 A41 41 0 1 1 49.99 9 Z",
  g: "M33 10 H67 L90 33 V67 L67 90 H33 L10 67 V33 Z",
  b: "M50 5 L93 50 L50 95 L7 50 Z",
  p: "M50 9 L93 86 Q95 90 90 90 H10 Q5 90 7 86 Z",
};
const TONES: Record<string, [string, string, string]> = {
  // light, base, edge
  r: ["#ff9aa6", "#e8213f", "#8f0f24"],
  y: ["#fff0a0", "#f5b800", "#a06a00"],
  g: ["#9dffc6", "#17b065", "#0a5c33"],
  b: ["#a6dcff", "#2a73f0", "#123e94"],
  p: ["#f0c4ff", "#9a3cf0", "#5a1a9a"],
};

/** Gradients and shapes every gem on the board uses (put this on the page once) */
export function GemDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {Object.entries(TONES).map(([c, [light, base, edge]]) => (
          <linearGradient key={c} id={`gm-g-${c}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.45" stopColor={base} />
            <stop offset="1" stopColor={edge} />
          </linearGradient>
        ))}
        {Object.entries(SHAPES).map(([c, d]) => (
          <clipPath key={c} id={`gm-c-${c}`}>
            <path d={d} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}

/** One gem: plain, striped (clears a row or column), bomb (clears around it) or star */
export function Gem({ g, className }: { g: string; className?: string }) {
  const k = kindOf(g);
  if (k === "star") {
    return (
      <span className={clsx("relative grid h-full w-full place-items-center", className)} aria-label="Star gem">
        <span
          className="gm-spin absolute inset-[8%] rounded-full shadow-[0_0_14px_3px_rgba(255,255,255,0.55)]"
          style={{ background: "conic-gradient(#ff5a7a, #ffd36b, #7dffb5, #7cc8ff, #c48bff, #ff5a7a)" }}
        />
        <span className="absolute inset-[22%] rounded-full bg-white/25 backdrop-blur-[1px]" />
        <svg viewBox="0 0 24 24" className="relative h-[46%] w-[46%] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" aria-hidden>
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z" fill="#fff" />
        </svg>
      </span>
    );
  }
  const c = colorOf(g)!;
  const d = SHAPES[c];
  return (
    <span className={clsx("relative block h-full w-full", k === "x" && "gm-pulse", className)}>
      {k === "x" && <span className="absolute inset-[2%] rounded-full bg-white/35 blur-[6px]" aria-hidden />}
      <svg viewBox="0 0 100 100" className="relative h-full w-full drop-shadow-[0_3px_2px_rgba(0,0,0,0.35)]" aria-label={`${NAMES[c]}${k === "h" || k === "v" ? ", striped" : k === "x" ? ", bomb" : ""}`}>
        <path d={d} fill={`url(#gm-g-${c})`} stroke={TONES[c][2]} strokeWidth="3" strokeLinejoin="round" />
        {/* The cut face in the middle */}
        <path d={d} fill={TONES[c][0]} opacity="0.35" transform="translate(50 52) scale(0.52) translate(-50 -50)" />
        {(k === "h" || k === "v") && (
          <g clipPath={`url(#gm-c-${c})`} opacity="0.95">
            {[34, 50, 66].map((p) =>
              k === "h" ? <rect key={p} x="0" y={p - 4} width="100" height="8" fill="#fff" /> : <rect key={p} x={p - 4} y="0" width="8" height="100" fill="#fff" />,
            )}
          </g>
        )}
        {k === "x" && <circle cx="50" cy="52" r="13" fill="#fff" opacity="0.9" />}
        <ellipse cx="36" cy="30" rx="13" ry="7" fill="#fff" opacity="0.55" transform="rotate(-28 36 30)" />
      </svg>
    </span>
  );
}

const NAMES: Record<string, string> = { r: "Ruby", y: "Topaz", g: "Emerald", b: "Sapphire", p: "Amethyst" };
