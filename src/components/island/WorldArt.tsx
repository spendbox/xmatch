"use client";

import { forwardRef, useId } from "react";
import { hash, key, type Axis, type Biome, type Piece, type Prop, type Tile, type WorldLayout } from "@/lib/world";

type Sky = "day" | "sunset" | "night";
type P = [number, number];
export type WorldView = { x: number; y: number; s: number };

/** Half a square's width on screen, and how tall the cliffs are */
export const TILE = 40;
const CLIFF = 14;

const SEA: Record<Sky, [string, string]> = {
  day: ["#b9e7ff", "#6cc0f0"],
  sunset: ["#ffd2b0", "#7aa9d8"],
  night: ["#24356f", "#0e1a42"],
};
const GROUND: Record<Biome, [string, string]> = {
  town: ["#a6e696", "#9adc8a"],
  forest: ["#86d27c", "#7cc872"],
  snow: ["#f6fbff", "#e9f3fb"],
  desert: ["#f8dd96", "#f2d185"],
  sand: ["#fbe7a8", "#f6dc98"],
};

/** Lighten (k > 1) or darken (k < 1) a colour */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const pts = (...ps: P[]) => ps.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join(" ");

/** Turn the grid a quarter at a time */
function turn(gx: number, gy: number, rot: number): P {
  switch (rot % 4) {
    case 1:
      return [-gy, gx];
    case 2:
      return [-gx, -gy];
    case 3:
      return [gy, -gx];
    default:
      return [gx, gy];
  }
}
const turnAxis = (a: Axis | undefined, rot: number): Axis => (!a || a === "both" || rot % 2 === 0 ? a ?? "x" : a === "x" ? "y" : "x");
/** Where a grid square sits on screen */
const proj = (rx: number, ry: number): P => [(rx - ry) * TILE, (rx + ry) * (TILE / 2)];
const diamond = (c: P, k = 1) => pts([c[0], c[1] - (TILE / 2) * k], [c[0] + TILE * k, c[1]], [c[0], c[1] + (TILE / 2) * k], [c[0] - TILE * k, c[1]]);
/** A strip across a square along x (or y), `h` squares wide each side of the middle */
function strip(c: P, axis: Axis, h: number, from = -0.5, to = 0.5): string {
  const u: P = axis === "y" ? [-TILE, TILE / 2] : [TILE, TILE / 2];
  const v: P = axis === "y" ? [TILE, TILE / 2] : [-TILE, TILE / 2];
  const at = (s: number, w: number): P => [c[0] + u[0] * s + v[0] * w, c[1] + u[1] * s + v[1] * w];
  return pts(at(from, -h), at(to, -h), at(to, h), at(from, h));
}
const line = (c: P, axis: Axis, from = -0.5, to = 0.5) => {
  const u: P = axis === "y" ? [-TILE, TILE / 2] : [TILE, TILE / 2];
  return `M${c[0] + u[0] * from} ${c[1] + u[1] * from} L${c[0] + u[0] * to} ${c[1] + u[1] * to}`;
};

/** How big the world looks on screen (for fitting it to the screen) */
export function worldExtent(layout: WorldLayout, rot = 0) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of layout.tiles) {
    const [x, y] = proj(...turn(t.gx, t.gy, rot));
    minX = Math.min(minX, x - TILE);
    maxX = Math.max(maxX, x + TILE);
    minY = Math.min(minY, y - TILE / 2);
    maxY = Math.max(maxY, y + TILE / 2 + CLIFF);
  }
  return { minX, maxX, minY: minY - 60, maxY: maxY + 10 };
}

// ---------------------------------------------------------------------------------------------
// Gradients the pieces use (ids are made unique per picture)

type G = { leaf: string; leaf2: string; pink: string; gold: string; water: string; rock: string; crystal: string; fall: string; sun: string; glow: string };
function Defs({ id }: { id: (s: string) => string }) {
  return (
    <>
      <radialGradient id={id("leaf")} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#a8f08e" /><stop offset="1" stopColor="#3da85a" /></radialGradient>
      <radialGradient id={id("leaf2")} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#7fd98a" /><stop offset="1" stopColor="#23824a" /></radialGradient>
      <radialGradient id={id("pink")} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#ffe0ee" /><stop offset="1" stopColor="#f08ab6" /></radialGradient>
      <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#f0a83a" /></linearGradient>
      <linearGradient id={id("water")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6e6ff" /><stop offset="1" stopColor="#3fa4e6" /></linearGradient>
      <linearGradient id={id("rock")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ab8a" /><stop offset=".6" stopColor="#9c6f74" /><stop offset="1" stopColor="#6f5276" /></linearGradient>
      <linearGradient id={id("crystal")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eaf8ff" /><stop offset=".5" stopColor="#b9a6ff" /><stop offset="1" stopColor="#7fe3d8" /></linearGradient>
      <linearGradient id={id("fall")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe9ff" /><stop offset="1" stopColor="#bfe9ff" stopOpacity="0" /></linearGradient>
      <radialGradient id={id("sun")} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#fff3b0" /><stop offset="1" stopColor="#ffb84a" /></radialGradient>
      <radialGradient id={id("glow")}><stop offset="0" stopColor="#ffe9a8" stopOpacity=".95" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
    </>
  );
}
const makeG = (u: (s: string) => string): G => ({ leaf: u("leaf"), leaf2: u("leaf2"), pink: u("pink"), gold: u("gold"), water: u("water"), rock: u("rock"), crystal: u("crystal"), fall: u("fall"), sun: u("sun"), glow: u("glow") });

const ANIM = `
@media (prefers-reduced-motion: no-preference) {
  .wa-lf{transform-box:fill-box;transform-origin:50% 100%;animation:wa-gust 7s ease-in-out infinite}
  .wa-d1{animation-delay:.35s}.wa-d2{animation-delay:.7s}.wa-d3{animation-delay:1.05s}
  .wa-flow{animation:wa-flow 1.4s linear infinite}
  .wa-fall{animation:wa-fall .9s linear infinite}
  .wa-bob{animation:wa-bob 3s ease-in-out infinite}
  .wa-drift{animation:wa-drift 14s ease-in-out infinite}
  .wa-blink{animation:wa-blink 2s ease-in-out infinite}
  .wa-rise{animation:wa-rise 2.6s ease-out infinite}
  .wa-spin{transform-box:fill-box;transform-origin:50% 50%;animation:wa-spin 24s linear infinite}
  .wa-ride{animation:wa-ride 6s ease-in-out infinite alternate}
  .wa-ridey{animation:wa-ridey 6s ease-in-out infinite alternate}
}
@keyframes wa-gust{0%{transform:rotate(0)}14%{transform:rotate(1deg)}28%{transform:rotate(-.5deg)}42%{transform:rotate(3deg) skewX(-2deg)}52%{transform:rotate(1.8deg) skewX(-1deg)}66%{transform:rotate(-.6deg)}82%{transform:rotate(.7deg)}100%{transform:rotate(0)}}
@keyframes wa-flow{to{stroke-dashoffset:-22}}
@keyframes wa-fall{to{stroke-dashoffset:-14}}
@keyframes wa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes wa-drift{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}
@keyframes wa-blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes wa-rise{0%{transform:translateY(0);opacity:0}25%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
@keyframes wa-spin{to{transform:rotate(360deg)}}
@keyframes wa-ride{0%{transform:translate(-10px,-5px)}100%{transform:translate(10px,5px)}}
@keyframes wa-ridey{0%{transform:translate(10px,-5px)}100%{transform:translate(-10px,5px)}}
`;

// ---------------------------------------------------------------------------------------------
// The soft clay toolkit: boxes (a square footprint half a square wide), roofs and windows

const round = { strokeLinejoin: "round" as const };
function Bx({ h, c, x = 0, y = 0, k = 1 }: { h: number; c: string; x?: number; y?: number; k?: number }) {
  const r = shade(c, 0.86);
  const t = shade(c, 1.12);
  return (
    <g transform={x || y || k !== 1 ? `translate(${x} ${y}) scale(${k})` : undefined}>
      <polygon points={pts([-20, 0], [0, 10], [0, 10 - h], [-20, -h])} fill={c} stroke={c} strokeWidth="2" {...round} />
      <polygon points={pts([0, 10], [20, 0], [20, -h], [0, 10 - h])} fill={r} stroke={r} strokeWidth="2" {...round} />
      <polygon points={pts([-20, -h], [0, -10 - h], [20, -h], [0, 10 - h])} fill={t} stroke={t} strokeWidth="2" {...round} />
    </g>
  );
}
function Roof({ y, c, k = 1 }: { y: number; c: string; k?: number }) {
  const r = shade(c, 0.8);
  return (
    <g transform={`translate(0 ${y}) scale(${k})`}>
      <polygon points="-22,0 0,11 0,-16" fill={c} stroke={c} strokeWidth="2" {...round} />
      <polygon points="0,11 22,0 0,-16" fill={r} stroke={r} strokeWidth="2" {...round} />
    </g>
  );
}
/** A window on the left wall (bottom-left corner at x, y) */
const WL = ({ x, y, c, h = 6 }: { x: number; y: number; c: string; h?: number }) => <polygon points={pts([x, y], [x + 5, y + 2.5], [x + 5, y + 2.5 - h], [x, y - h])} fill={c} />;
/** A window on the right wall */
const WR = ({ x, y, c, h = 6 }: { x: number; y: number; c: string; h?: number }) => <polygon points={pts([x, y], [x + 5, y - 2.5], [x + 5, y - 2.5 - h], [x, y - h])} fill={c} />;
const Shadow = ({ rx = 26 }: { rx?: number }) => <ellipse cx="0" cy="4" rx={rx} ry={rx / 3} fill="#5a3a5a" opacity=".16" />;

/** Awning stripes along the right wall, top edge `y` below the roof line */
function AwningR({ y, a, b = "#fff" }: { y: number; a: string; b?: string }) {
  const s = (i: number, c: string) => <polygon key={i} points={pts([i * 5, y - i * 2.5], [i * 5 + 5, y - i * 2.5 - 2.5], [i * 5 + 9, y - i * 2.5 + 2.5], [i * 5 + 4, y - i * 2.5 + 5])} fill={c} />;
  return <g>{[0, 1, 2, 3].map((i) => s(i, i % 2 ? b : a))}</g>;
}
function AwningL({ y, a, b = "#fff" }: { y: number; a: string; b?: string }) {
  const s = (i: number, c: string) => <polygon key={i} points={pts([-20 + i * 5, y + i * 2.5], [-15 + i * 5, y + i * 2.5 + 2.5], [-19 + i * 5, y + i * 2.5 + 7.5], [-24 + i * 5, y + i * 2.5 + 5])} fill={c} />;
  return <g>{[0, 1, 2, 3].map((i) => s(i, i % 2 ? b : a))}</g>;
}

function Trunk({ h = 12 }: { h?: number }) {
  return <rect x="-2.2" y={-h + 1} width="4.4" height={h} rx="2.2" fill="#b07a4c" />;
}
function RoundTree({ g, d = "" }: { g: G; d?: string }) {
  return (
    <g>
      <Trunk />
      <g className={`wa-lf ${d}`}>
        <circle cx="0" cy="-21" r="10" fill={g.leaf} />
        <circle cx="-7" cy="-14" r="7.5" fill={g.leaf} />
        <circle cx="7" cy="-14" r="7.5" fill={g.leaf} />
        <circle cx="-3.5" cy="-25" r="3.5" fill="#e1ffd2" opacity=".7" />
      </g>
    </g>
  );
}
function PineTree({ g, snow, d = "" }: { g: G; snow?: boolean; d?: string }) {
  return (
    <g>
      <Trunk h={9} />
      <g className={`wa-lf ${d}`}>
        <path d="M0 -40 C5 -29 12 -16 12 -12 C12 -6 -12 -6 -12 -12 C-12 -16 -5 -29 0 -40 Z" fill={g.leaf2} />
        {snow ? (
          <>
            <path d="M0 -40 C3 -34 5 -30 6 -27 C3 -28 1 -26 -1 -28 C-3 -26 -5 -27 -6 -27 C-5 -30 -3 -34 0 -40 Z" fill="#fff" />
            <path d="M-9 -16 C-5 -19 -2 -17 0 -19 C3 -17 6 -19 10 -16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <path d="M-3 -33 C-5 -26 -7 -20 -7 -16" stroke="#c6f5b8" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".7" />
        )}
      </g>
    </g>
  );
}
function Palm({ g, d = "" }: { g: G; d?: string }) {
  return (
    <g>
      <path d="M0 0 C1 -8 3 -16 6 -24" stroke="#b07a4c" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <g className={`wa-lf ${d}`}>
        <g transform="translate(6 -24)" fill={g.leaf2}>
          {[15, 55, 125, 165, -30, 210].map((a) => (
            <ellipse key={a} cx="9" cy="0" rx="9" ry="3" transform={`rotate(${a})`} />
          ))}
          <circle cx="-1" cy="2" r="2" fill="#8a5a36" />
          <circle cx="2" cy="2.5" r="2" fill="#8a5a36" />
        </g>
      </g>
    </g>
  );
}
function Cactus({ k = 1 }: { k?: number }) {
  return (
    <g transform={`scale(${k})`}>
      <path d="M0 0 V-20" stroke="#4fae5a" strokeWidth="6" strokeLinecap="round" />
      <path d="M0 -10 H-6 V-16" stroke="#4fae5a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M0 -13 H6 V-19" stroke="#4fae5a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M-1.3 -18 V-4" stroke="#8ee08a" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}
function Mountain({ k = 1 }: { k?: number }) {
  return (
    <g transform={`scale(${k})`}>
      <polygon points="-32,6 -4,16 -6,-48" fill="#b7a89c" stroke="#b7a89c" strokeWidth="3" {...round} />
      <polygon points="-4,16 30,4 -6,-48" fill="#8f8174" stroke="#8f8174" strokeWidth="3" {...round} />
      <polygon points="-6,-48 -20,-20 -14,-22 -10,-16 -6,-20" fill="#fff" stroke="#fff" strokeWidth="2" {...round} />
      <polygon points="-6,-48 -6,-20 -1,-16 4,-21 9,-18" fill="#e3edf6" stroke="#e3edf6" strokeWidth="2" {...round} />
    </g>
  );
}
function Stall({ c }: { c: string }) {
  return (
    <g>
      <Bx h={14} c="#f0b46e" />
      <path d="M-20 -14 L-23 -33 M20 -14 L23 -33 M0 -4 L0 -22" stroke="#b07a4c" strokeWidth="2" strokeLinecap="round" />
      <g fill="#ff8a3d"><circle cx="-8" cy="-17" r="2.6" /><circle cx="-3" cy="-15" r="2.6" /></g>
      <g fill="#7fd98a"><circle cx="6" cy="-18" r="2.6" /><circle cx="10" cy="-16" r="2.6" /></g>
      <polygon points="-24,-34 0,-46 24,-34 0,-22" fill={c} stroke={c} strokeWidth="2" {...round} />
      <polygon points="-18,-37 -15,-38.5 9,-26.5 6,-25" fill="#fff" />
      <polygon points="-6,-43 -3,-44.5 21,-32.5 18,-31" fill="#fff" />
    </g>
  );
}
function Umbrella({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 V-14" stroke="#9c7a6a" strokeWidth="1.2" />
      <path d="M-9 -12 C-6 -19 6 -19 9 -12 Z" fill={c} />
      <ellipse cx="0" cy="-4" rx="5" ry="2" fill="#fff" />
    </g>
  );
}
function Notes() {
  return (
    <>
      <g className="wa-rise" fill="#7b66ee"><circle cx="16" cy="-44" r="2.4" /><rect x="18" y="-54" width="1.4" height="10" /></g>
      <g className="wa-rise" style={{ animationDelay: "1.3s" }} fill="#ff7aa8"><circle cx="-16" cy="-40" r="2.2" /><rect x="-14" y="-50" width="1.4" height="10" /></g>
    </>
  );
}
function Gazebo({ lights }: { lights?: boolean }) {
  return (
    <g>
      <ellipse cx="0" cy="-1" rx="26" ry="11" fill="#f6f1ea" />
      <path d="M-20 -2 V-28 M-8 6 V-22 M8 6 V-22 M20 -2 V-28" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M-26 -28 L0 -50 L26 -28 C18 -23 -18 -23 -26 -28 Z" fill="#ff9ec4" />
      <path d="M0 -50 L26 -28 C20 -25 12 -24 6 -24 Z" fill="#e87aa8" />
      {lights && (
        <g fill="#ffd36b">
          <circle className="wa-blink" cx="-16" cy="-21" r="1.4" /><circle cx="-6" cy="-20" r="1.4" /><circle className="wa-blink" cx="6" cy="-20" r="1.4" /><circle cx="16" cy="-21" r="1.4" />
        </g>
      )}
      <path d="M0 -56 c-2 -3 -6 -1 -4 2 l4 4 l4 -4 c2 -3 -2 -5 -4 -2 Z" fill="#ff6b8a" />
    </g>
  );
}
function Treehouse({ g, k = 1 }: { g: G; k?: number }) {
  return (
    <g transform={`scale(${k})`}>
      <g className="wa-lf">
        <circle cx="0" cy="-56" r="18" fill={g.leaf} /><circle cx="-17" cy="-46" r="13" fill={g.leaf} /><circle cx="17" cy="-46" r="13" fill={g.leaf} />
      </g>
      <path d="M-6 8 C-5 -10 -4 -28 -3 -36 L3 -36 C4 -28 5 -10 6 8 Z" fill="#b07a4c" />
      <polygon points="-22,-30 0,-41 22,-30 0,-19" fill="#c98a5e" />
      <g transform="translate(0 -30) scale(.62)"><Bx h={14} c="#fff4e4" /><Roof y={-14} c="#ff8f7a" /></g>
      <path d="M-14 8 L-14 -22 M-9 10 L-9 -20 M-14 2 H-9 M-14 -6 H-9 M-14 -14 H-9" stroke="#e0b07a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 -28 V-4 M20 -31 V-7" stroke="#9c7a6a" strokeWidth="1" />
    </g>
  );
}
function FerrisWheel() {
  return (
    <g>
      <ellipse cx="0" cy="6" rx="20" ry="6" fill="#efeaff" />
      <path d="M-14 6 L0 -34 L14 6" stroke="#c9bff0" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <g className="wa-spin">
        <circle cx="0" cy="-34" r="28" fill="none" stroke="#ff8fb1" strokeWidth="3" />
        <path d="M0 -62 V-6 M-28 -34 H28 M-20 -54 L20 -14 M20 -54 L-20 -14" stroke="#ffd1df" strokeWidth="1.2" />
        {[["0", "-62", "#7b66ee"], ["28", "-34", "#7fe3c4"], ["0", "-6", "#ffd36b"], ["-28", "-34", "#6fa6ff"], ["20", "-54", "#ff8f7a"], ["20", "-14", "#b59cff"], ["-20", "-14", "#ff8fb1"], ["-20", "-54", "#7fd98a"]].map(([x, y, c]) => (
          <circle key={x + y} cx={x} cy={y} r="4.2" fill={c} />
        ))}
      </g>
      <circle cx="0" cy="-34" r="3.2" fill="#fff" stroke="#ff8fb1" strokeWidth="2" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// One piece (a building or garden that a message made)

function PieceArt({ p, g, night }: { p: Piece; g: G; night: boolean }) {
  const L = p.level;
  const win = night ? "#ffd36b" : "#9fd6ff";
  const warm = night ? "#ffd36b" : "#ffe9a8";
  switch (p.kind) {
    case "home":
      if (L === 1)
        return (
          <g>
            <Shadow />
            <Bx h={14} c={p.wall} />
            <rect x="7" y="-31" width="4" height="9" rx="1" fill="#e8665a" />
            <Roof y={-14} c={p.roof} />
            <polygon points="5,7.5 10,5 10,-3 5,-.5" fill="#8b78f0" />
            <WL x={-14} y={-1} c={win} />
            <WR x={13} y={2.5} c={win} />
          </g>
        );
      if (L === 2)
        return (
          <g>
            <Shadow />
            <Bx h={32} c={p.wall} />
            <Roof y={-32} c={p.roof} />
            <WL x={-15} y={-1.5} c={warm} /><WL x={-7} y={2.5} c={warm} /><WL x={-15} y={-14.5} c={warm} /><WL x={-7} y={-10.5} c={warm} />
            <WR x={12} y={0} c={warm} /><WR x={4} y={-9} c={warm} /><WR x={12} y={-13} c={warm} />
            <polygon points="3,8.5 8,6 8,-2 3,.5" fill={p.roof} />
          </g>
        );
      return (
        <g>
          <Shadow />
          <Bx h={46} c={p.wall} />
          {[0, 11, 22, 33].map((dy) => (
            <g key={dy}>
              <WL x={-16} y={-2 - dy} c={win} /><WL x={-8} y={2 - dy} c={win} />
              <WR x={4} y={4 - dy} c={win} /><WR x={12} y={0 - dy} c={win} />
            </g>
          ))}
          <rect x="2" y="-58" width="8" height="7" rx="1.5" fill="#c9bff0" />
        </g>
      );
    case "food":
      if (L === 1) return <g><Shadow /><Stall c={p.roof} /></g>;
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={22} c="#ffeedd" />
          <Roof y={-22} c="#c9563f" />
          <WL x={-16} y={-4} c={warm} /><WL x={-8} y={0} c={warm} /><WR x={4} y={3} c={warm} /><WR x={12} y={-1} c={warm} />
          <AwningL y={-16} a="#e8665a" />
          {L === 3 && (
            <g fill="#ffd36b">
              <circle className="wa-blink" cx="-14" cy="-18.6" r="1.1" /><circle cx="-7" cy="-15.4" r="1.1" /><circle className="wa-blink" cx="7" cy="-15.6" r="1.1" /><circle cx="14" cy="-18.8" r="1.1" />
            </g>
          )}
        </g>
      );
    case "cafe":
      return (
        <g transform={L === 1 ? "scale(.8)" : undefined}>
          <Shadow />
          <Bx h={L === 1 ? 16 : 22} c={p.wall} />
          <polygon points="4,6 16,0 16,-7 4,-1" fill={warm} />
          <polygon points="-8,6 -3,8.5 -3,.5 -8,-2" fill="#8b78f0" />
          <AwningR y={-4} a="#ff8fb1" />
          <g transform={`translate(0 ${L === 1 ? -24 : -30})`}>
            <path d="M-6 -4 H6 L5 5 C4 8 -4 8 -5 5 Z" fill="#fff" />
            <path d="M6 -1 C10 -1 10 5 5 4" stroke="#fff" strokeWidth="2" fill="none" />
            <ellipse cx="0" cy="-4" rx="6" ry="1.8" fill="#a8704a" />
          </g>
          {L >= 2 && <Umbrella x={-30} y={8} c="#ff8fb1" />}
          {L === 3 && <Umbrella x={28} y={10} c="#7fe3c4" />}
        </g>
      );
    case "sweet":
      if (L === 1)
        return (
          <g>
            <Shadow rx={16} />
            <Bx h={12} c="#fff0f6" k={0.6} />
            <ellipse cx="-6" cy="4" rx="3" ry="3.2" fill="#5a5470" /><ellipse cx="6" cy="6" rx="3" ry="3.2" fill="#5a5470" />
            <Umbrella x={0} y={-6} c="#7fe3c4" />
          </g>
        );
      return (
        <g transform={L === 3 ? "scale(1.1)" : undefined}>
          <Shadow />
          <Bx h={22} c="#fff0f6" />
          <polygon points="4,6 16,0 16,-7 4,-1" fill="#c9f0e4" />
          <polygon points="-8,6 -3,8.5 -3,.5 -8,-2" fill="#ff8fb1" />
          <AwningR y={-4} a="#7fe3c4" />
          <g transform="translate(0 -24)">
            <polygon points="-6,-16 6,-16 0,0" fill="#f0b46e" />
            <circle cx="-3" cy="-19" r="5" fill="#ff9ec4" /><circle cx="3" cy="-20" r="5" fill="#9fe8c8" /><circle cx="0" cy="-26" r="4.6" fill="#fff6e8" /><circle cx="1" cy="-31" r="1.8" fill="#e8475a" />
          </g>
        </g>
      );
    case "music":
      if (L === 1) return <g><Shadow /><g transform="scale(.75)"><Gazebo /></g><Notes /></g>;
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={22} c="#efeaff" />
          <path d="M-12 -22 A12 10 0 0 1 12 -22 Z" fill={g.gold} />
          <path d="M0 -32 V-40" stroke="#9c7a6a" strokeWidth="1" /><path d="M0 -40 L7 -38 L0 -36 Z" fill="#ff7aa8" />
          <WL x={-17} y={-4} c="#7d6ad8" /><WL x={-9} y={0} c="#7d6ad8" />
          <polygon points="4,8 10,5 10,-4 4,-1" fill="#7d6ad8" />
          <Notes />
        </g>
      );
    case "sport":
      if (L === 3)
        return (
          <g transform="scale(.62)">
            <ellipse cx="0" cy="-2" rx="48" ry="21" fill="#b5abd9" /><ellipse cx="0" cy="-12" rx="48" ry="21" fill="#efeaff" />
            <ellipse cx="0" cy="-12" rx="38" ry="15" fill="#d8d0f5" /><ellipse cx="0" cy="-10" rx="30" ry="11" fill="#56c26a" />
            <path d="M0 -21 V1" stroke="#fff" strokeWidth="1.2" /><ellipse cx="0" cy="-10" rx="5" ry="2.4" fill="none" stroke="#fff" strokeWidth="1.2" />
            <path d="M-44 -12 V-44 M44 -12 V-44" stroke="#9c9ab0" strokeWidth="1.6" />
            <rect className="wa-blink" x="-48" y="-48" width="8" height="4" rx="1" fill="#fff6c8" /><rect className="wa-blink" x="40" y="-48" width="8" height="4" rx="1" fill="#fff6c8" />
          </g>
        );
      return (
        <g>
          <polygon points="-34,0 0,-17 34,0 0,17" fill="#56c26a" stroke="#4aac5e" strokeWidth="4" {...round} />
          <polygon points="-28,0 0,-14 28,0 0,14" fill="none" stroke="#fff" strokeWidth="1.4" />
          <line x1="-14" y1="-7" x2="14" y2="7" stroke="#fff" strokeWidth="1.2" />
          <ellipse cx="0" cy="0" rx="6" ry="3" fill="none" stroke="#fff" strokeWidth="1.2" />
          {L === 2 && (
            <>
              <path d="M-30 -2 V-34 M30 -2 V-34" stroke="#9c9ab0" strokeWidth="1.6" />
              <rect className="wa-blink" x="-34" y="-38" width="8" height="4" rx="1" fill="#fff6c8" /><rect className="wa-blink" x="26" y="-38" width="8" height="4" rx="1" fill="#fff6c8" />
            </>
          )}
        </g>
      );
    case "court":
      return (
        <g>
          {L >= 2 && <polygon points="-32,0 0,-16 32,0 0,16" fill="#ff9f5a" stroke="#f08a46" strokeWidth="3" {...round} />}
          {L >= 2 && <polygon points="-26,0 0,-13 26,0 0,13" fill="none" stroke="#fff" strokeWidth="1.2" />}
          <path d="M-14 -2 V-26" stroke="#5a5470" strokeWidth="1.6" />
          <rect x="-19" y="-34" width="10" height="8" rx="1" fill="#fff" stroke="#5a5470" strokeWidth="1" />
          <ellipse cx="-10" cy="-25" rx="3" ry="1.4" fill="none" stroke="#ff6b3a" strokeWidth="1.4" />
          <circle cx="8" cy="2" r="3.4" fill="#ff7a2a" />
          {L === 3 && <g transform="translate(18 -10) scale(.6)"><Bx h={22} c="#ffe3cf" /></g>}
        </g>
      );
    case "school":
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={L === 1 ? 18 : 22} c="#ffe9b8" />
          <WL x={-17} y={-2} c={win} /><WL x={-9} y={2} c={win} /><WR x={10} y={1} c={win} />
          <polygon points="2,9 7,6.5 7,-1.5 2,1" fill="#e8665a" />
          <g transform={`translate(-10 ${L === 1 ? -11 : -14}) skewY(26.565)`}><circle r="3.6" fill="#fff" stroke="#c98a5e" strokeWidth="1" /><path d="M0 0 V-2.4 M0 0 H1.8" stroke="#2b2340" strokeWidth=".9" /></g>
          {L >= 2 && <g transform="translate(0 -22) scale(.4)"><Bx h={14} c="#ffe9b8" /><Roof y={-14} c="#e8665a" /></g>}
          <path d="M24 4 V-34" stroke="#9c9ab0" strokeWidth="1.2" /><path d="M24 -34 L33 -31 L24 -28 Z" fill="#7b66ee" />
        </g>
      );
    case "books":
      if (L === 1)
        return (
          <g>
            <Shadow rx={16} />
            <rect x="-12" y="-8" width="24" height="3.4" rx="1.7" fill="#c98a5e" /><path d="M-9 -4 V2 M9 -4 V2" stroke="#9c6a42" strokeWidth="1.8" />
            <g transform="translate(0 -12)"><path d="M0 4 C-4 1 -9 1 -12 2 V-6 C-9 -7 -4 -7 0 -4 Z" fill="#fff" /><path d="M0 4 C4 1 9 1 12 2 V-6 C9 -7 4 -7 0 -4 Z" fill="#f3ecf9" /></g>
          </g>
        );
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={22} c="#f4efe6" />
          <path d="M-17 1.5 V-16.5 M-12 4 V-14 M-7 6.5 V-11.5 M-2 9 V-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <polygon points="-21,-21 1,-10 -9,-28" fill="#fff" />
          <WR x={10} y={1} c={warm} />
          <g transform="translate(4 -34)"><path d="M0 4 C-4 1 -9 1 -12 2 V-6 C-9 -7 -4 -7 0 -4 Z" fill="#fff" /><path d="M0 4 C4 1 9 1 12 2 V-6 C9 -7 4 -7 0 -4 Z" fill="#f3ecf9" /></g>
        </g>
      );
    case "office": {
      const h = L === 1 ? 22 : L === 2 ? 46 : 66;
      const bands: string[] = [];
      for (let y = 10; y < h - 4; y += 10) bands.push(`M-20 ${-y} L0 ${10 - y} M0 ${10 - y} L20 ${-y}`);
      return (
        <g transform={L === 3 ? "scale(.8)" : undefined}>
          <Shadow />
          <Bx h={h} c={L === 3 ? "#bcd8ff" : "#d0e0ff"} />
          <path d={`${bands.join(" ")} M-10 5 V${-h + 5} M10 5 V${-h + 5}`} stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" />
          {night && <path d={bands.slice(0, 3).join(" ")} stroke="#ffd36b" strokeWidth="1.6" opacity=".7" />}
          {L === 3 && (
            <>
              <path d={`M0 ${-h} V${-h - 14}`} stroke="#9c9ab0" strokeWidth="1.6" />
              <circle className="wa-blink" cx="0" cy={-h - 15} r="2" fill="#ff6b6b" />
            </>
          )}
        </g>
      );
    }
    case "gym":
      return (
        <g transform={`scale(${0.9 + L * 0.08})`}>
          <Shadow />
          <Bx h={22} c="#ffd6cc" />
          <polygon points="-18,-2 -4,5 -4,-9 -18,-16" fill={warm} />
          <polygon points="4,6 16,0 16,-12 4,-6" fill={warm} />
          <g transform="translate(0 -36)"><path d="M-10 0 H10" stroke="#5a5470" strokeWidth="2.6" /><rect x="-15" y="-5" width="5" height="10" rx="2" fill="#2b2340" /><rect x="10" y="-5" width="5" height="10" rx="2" fill="#2b2340" /></g>
        </g>
      );
    case "clinic":
      return (
        <g>
          <Shadow />
          <Bx h={L === 3 ? 32 : 22} c="#ffffff" />
          <polygon points="-20,-2 0,8 0,6 -20,-4" fill="#2bb3a3" />
          <g transform="translate(-10 -9) skewY(26.565)" fill="#2bb3a3"><rect x="-4.5" y="-1.6" width="9" height="3.2" rx="1" /><rect x="-1.6" y="-4.5" width="3.2" height="9" rx="1" /></g>
          <WR x={10} y={-4} c={night ? "#ffd36b" : "#bfeee6"} />
          <polygon points="3,6 8,3.5 8,-4.5 3,-2" fill="#bfeee6" />
          {L >= 2 && <path d="M0 -38 c-2 -3 -6 -1 -4 2 l4 4 l4 -4 c2 -3 -2 -5 -4 -2 Z" fill="#ff6b8a" transform={`translate(0 ${L === 3 ? -10 : 0})`} />}
        </g>
      );
    case "market":
      return (
        <g>
          <Shadow rx={30} />
          {L >= 2 && <g transform="translate(-14 -4) scale(.6)"><Stall c="#7fb2ff" /></g>}
          <g transform={L === 1 ? "scale(.75)" : "translate(12 4) scale(.6)"}><Stall c="#ff8fb1" /></g>
          {L === 3 && <g transform="translate(-2 -14) scale(.5)"><Stall c="#7fe3c4" /></g>}
        </g>
      );
    case "cinema":
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={L === 1 ? 22 : 32} c="#8b78f0" />
          <polygon points={pts([-20, L === 1 ? -12 : -22], [0, L === 1 ? -2 : -12], [0, L === 1 ? 5 : -5], [-20, L === 1 ? -5 : -15])} fill="#ffd36b" />
          <polygon points="-12,4 -4,8 -4,-1 -12,-5" fill="#2b2340" />
          <g transform={`translate(0 ${L === 1 ? -38 : -48})`}><circle r="7" fill="#2b2340" /><g fill="#fff"><circle cx="0" cy="-3.6" r="1.6" /><circle cx="3.6" cy="0" r="1.6" /><circle cx="0" cy="3.6" r="1.6" /><circle cx="-3.6" cy="0" r="1.6" /></g></g>
        </g>
      );
    case "pool":
      return (
        <g transform={`scale(${0.62 + L * 0.06})`}>
          <polygon points="-46,-6 0,-29 46,-6 0,17" fill="#f6f1ea" stroke="#f6f1ea" strokeWidth="4" {...round} />
          <polygon points="-46,-6 0,17 0,22 -46,-1" fill="#ddd2c4" /><polygon points="0,17 46,-6 46,-1 0,22" fill="#c9bcac" />
          <polygon points="-34,-6 0,-23 34,-6 0,11" fill={g.water} stroke="#fff" strokeWidth="2" {...round} />
          <g transform="translate(6 -14)"><ellipse rx="6" ry="3" fill="none" stroke="#ff8fb1" strokeWidth="3" /></g>
          {L === 3 && <path d="M-30 -10 C-30 -40 -10 -40 -6 -14" stroke="#ff8f7a" strokeWidth="5" fill="none" strokeLinecap="round" />}
        </g>
      );
    case "travel":
      if (L === 2)
        return (
          <g transform="scale(.8)">
            <polygon points="-30,6 4,-11 30,2 -4,19" fill="#ddd6ea" />
            <path d="M-16 6 V-22 M4 -4 V-32 M14 4 V-24 M-6 14 V-14" stroke="#c9bff0" strokeWidth="2.4" />
            <rect x="-9" y="-8" width="6" height="12" rx="1.5" fill="#ff8f7a" /><rect x="5" y="-14" width="6" height="12" rx="1.5" fill="#7fe3c4" />
            <polygon points="-26,-24 6,-40 30,-28 -2,-12" fill="#fff" />
            <polygon points="-26,-24 -2,-12 -2,-8 -26,-20" fill="#ff8f7a" /><polygon points="-2,-12 30,-28 30,-24 -2,-8" fill="#e8665a" />
          </g>
        );
      return (
        <g transform="scale(.8)">
          <polygon points="-24,4 6,-11 18,-5 -12,10" fill="#ddd6ea" />
          <polygon points="-18,-2 6,-14 6,-36 -18,-24" fill="#cfeaff" opacity=".85" />
          <path d="M-18 -2 V-26 M6 -14 V-38 M-10 6 V-20 M14 -6 V-32" stroke="#8b78f0" strokeWidth="2" strokeLinecap="round" />
          <polygon points="-22,-28 8,-43 18,-37 -12,-22" fill="#8b78f0" />
          <polygon points="-14,-6 4,-15 8,-13 -10,-4" fill="#c98a5e" />
          <path d="M24 6 V-36" stroke="#9c9ab0" strokeWidth="1.6" /><circle cx="24" cy="-38" r="5" fill="#6fa6ff" stroke="#fff" strokeWidth="1.4" />
          {L === 3 && <g transform="translate(-2 18) scale(.6)"><BusArt c="#ffb84a" /></g>}
        </g>
      );
    case "lamp":
      return (
        <g>
          {night && <circle cx="6" cy="-36" r="14" fill={g.glow} />}
          <path d="M-6 6 V-34 C-6 -40 2 -42 6 -38" stroke="#5a5470" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M2 -38 H10 L8 -34 H4 Z" fill="#5a5470" />
          <ellipse cx="6" cy="-33" rx="2.6" ry="1.4" fill="#fff6c8" />
          {L >= 2 && <g transform="translate(14 6)"><rect x="-12" y="-6" width="24" height="3" rx="1.5" fill="#c98a5e" /><rect x="-12" y="-12" width="24" height="2.6" rx="1.3" fill="#c98a5e" /><path d="M-9 -3 V2 M9 -3 V2" stroke="#9c6a42" strokeWidth="1.6" /></g>}
          {L === 3 && <g transform="translate(-20 8)"><ellipse rx="9" ry="4" fill="#e9e1ef" /><ellipse cy="-1" rx="7" ry="3" fill={g.water} /></g>}
        </g>
      );
    case "garden":
      if (L === 3)
        return (
          <g transform="scale(.6)">
            <ellipse cx="0" cy="-2" rx="40" ry="18" fill="#a6e696" /><ellipse cx="0" cy="-4" rx="24" ry="10" fill="#f3e3c4" />
            <ellipse cx="0" cy="-6" rx="15" ry="6.5" fill="#f6f2fa" /><ellipse cx="0" cy="-6" rx="12" ry="5" fill={g.water} />
            <rect x="-2" y="-22" width="4" height="16" fill="#e9e1ef" /><ellipse cx="0" cy="-22" rx="7" ry="2.6" fill="#f6f2fa" />
            <path d="M0 -24 C-2 -32 -8 -32 -10 -24 M0 -24 C2 -32 8 -32 10 -24 M0 -24 V-34" stroke="#8fd6ff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        );
      if (L === 2)
        return (
          <g>
            <path d="M-16 8 V-12 C-16 -32 16 -32 16 -12 V8" stroke="#fff4e4" strokeWidth="4.4" fill="none" strokeLinecap="round" />
            <path d="M-16 6 C-20 0 -12 -6 -17 -12 C-20 -20 -10 -26 0 -28 C10 -26 20 -20 17 -12 C12 -6 20 0 16 6" stroke="#4fae5a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <g fill="#ff6b8a"><circle cx="-17" cy="-4" r="2.6" /><circle cx="-12" cy="-22" r="2.6" /><circle cx="0" cy="-28" r="2.8" /><circle cx="12" cy="-22" r="2.6" /><circle cx="17" cy="0" r="2.6" /></g>
          </g>
        );
      return (
        <g>
          <polygon points="-22,4 0,15 0,19 -22,8" fill="#c98a5e" /><polygon points="0,15 22,4 22,8 0,19" fill="#a86c46" />
          <polygon points="-22,4 0,-7 22,4 0,15" fill="#8a5a3c" stroke="#c98a5e" strokeWidth="2.4" {...round} />
          {[[-12, 2, "#ff8fb1"], [-4, -3, "#ffd36b"], [4, 4, "#b59cff"], [10, -1, "#ff6b6b"], [-4, 8, "#fff"], [12, 6, "#ff8fb1"]].map(([x, y, c]) => (
            <g key={`${x}${y}`}><path d={`M${x} ${+y + 4} V${y}`} stroke="#4fae5a" strokeWidth="1.4" /><circle cx={x} cy={+y - 1} r="3" fill={c as string} /></g>
          ))}
        </g>
      );
    case "rocks":
      if (L === 3)
        return (
          <g>
            <Shadow rx={16} />
            <Bx h={10} c="#e9e4f0" k={0.6} />
            <g transform="translate(0 -6)"><rect x="-4" y="-24" width="8" height="18" rx="3" fill="#c9bff0" /><circle cx="0" cy="-28" r="5" fill="#c9bff0" /><path d="M-4 -18 L-10 -26 M4 -18 L10 -26" stroke="#c9bff0" strokeWidth="3" strokeLinecap="round" /></g>
          </g>
        );
      return (
        <g>
          <path d="M-20 8 C-22 -2 -14 -10 -4 -10 C6 -10 9 -2 7 6 C5 12 -16 14 -20 8 Z" fill="#bdb3ad" />
          <path d="M-15 -1 C-12 -7 -7 -8 -3 -8" stroke="#e9e4e0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M4 12 C3 6 9 1 16 3 C22 5 24 11 21 14 C18 16 6 16 4 12 Z" fill="#cbc2bc" />
          {L === 2 && <path d="M-26 -6 V-20 M26 -4 V-18 M-8 -16 V-28" stroke="#cbc2bc" strokeWidth="5" strokeLinecap="round" />}
        </g>
      );
    case "tree": {
      const k = L === 1 ? 1 : L === 2 ? 1.25 : 1.5;
      if (p.biome === "desert") return <g><Shadow rx={12} /><Cactus k={k} /></g>;
      if (p.biome === "snow") return <g transform={`scale(${k})`}><PineTree g={g} snow /></g>;
      if (p.biome === "forest") return <g transform={`scale(${k})`}><PineTree g={g} /></g>;
      if (L === 3)
        return (
          <g transform="scale(1.1)">
            <path d="M-5 0 C-4 -6 -3 -12 -2 -16 L-8 -22 L-6 -23 L0 -18 L5 -24 L7 -23 L3 -16 C3 -10 4 -4 6 0 Z" fill="#9c6a42" />
            <g className="wa-lf"><circle cx="-12" cy="-28" r="11" fill={g.leaf2} /><circle cx="12" cy="-28" r="11" fill={g.leaf2} /><circle cx="0" cy="-36" r="13" fill={g.leaf} /><circle cx="-18" cy="-20" r="8" fill={g.leaf} /><circle cx="18" cy="-20" r="8" fill={g.leaf} /></g>
          </g>
        );
      return <g transform={`scale(${k})`}><RoundTree g={g} /></g>;
    }
    case "palm":
      return (
        <g>
          <g transform={L === 1 ? undefined : "translate(-8 -2)"}><Palm g={g} /></g>
          {L >= 2 && <g transform="translate(10 4) scale(.85)"><Palm g={g} d="wa-d1" /></g>}
          {L === 3 && <g transform="translate(-2 10) scale(.7)"><Palm g={g} d="wa-d2" /></g>}
        </g>
      );
    case "pets":
      return (
        <g>
          <Shadow rx={22} />
          {L >= 2 && <g transform="translate(-14 -4) scale(.6)"><Bx h={22} c="#fff0e6" /><WR x={6} y={0} c={warm} h={8} /></g>}
          <g transform={L >= 2 ? "translate(8 4) scale(.6)" : "translate(-8 0) scale(.8)"}><Bx h={14} c="#ff9f86" /><Roof y={-14} c="#8b78f0" /><g transform="translate(-10 0) skewY(26.565)"><path d="M-4 1 V-5 A4 4 0 0 1 4 -5 V1 Z" fill="#5a3a5a" /></g></g>
          <g transform={L >= 2 ? "translate(22 10) scale(.7)" : "translate(16 6) scale(.8)"}>
            <ellipse cx="0" cy="-6" rx="9" ry="5.6" fill="#f2c48c" /><circle cx="-8" cy="-12" r="5.4" fill="#f2c48c" /><circle cx="-10" cy="-13" r="1" fill="#2b2340" /><ellipse cx="-5" cy="-14" rx="2" ry="3.6" fill="#b07a4c" transform="rotate(20 -5 -14)" />
            <path d="M8 -8 C12 -10 14 -14 13 -17" stroke="#e9b77a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </g>
        </g>
      );
    case "games":
      return (
        <g transform={`scale(${L === 1 ? 0.75 : L === 2 ? 1 : 1.1})`}>
          <Shadow />
          <Bx h={22} c="#ff9ad5" />
          <WL x={-17} y={-2} c="#7fe3d8" /><WL x={-9} y={2} c="#ffd36b" /><WR x={10} y={1} c="#b59cff" />
          <polygon points="2,9 7,6.5 7,-1.5 2,1" fill="#2b2340" />
          <g transform="translate(0 -38)"><rect x="-12" y="-6" width="24" height="12" rx="6" fill="#2b2340" /><path d="M-7 0 H-3 M-5 -2 V2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /><circle className="wa-blink" cx="5" cy="-1.5" r="1.6" fill="#ff6b6b" /><circle cx="8" cy="1.5" r="1.6" fill="#7fe3d8" /></g>
        </g>
      );
    case "art":
      if (L === 1)
        return (
          <g>
            <path d="M-8 6 L0 -26 L8 6 M0 -26 V8" stroke="#b07a4c" strokeWidth="2" strokeLinecap="round" />
            <rect x="-10" y="-22" width="20" height="16" rx="1" fill="#fff6dc" stroke="#d9a06a" strokeWidth="1.2" />
            <circle cx="-4" cy="-15" r="3.4" fill="#ff8fb1" /><polygon points="0,-8 8,-8 4,-17" fill="#7fe3c4" />
          </g>
        );
      return (
        <g transform={L === 3 ? "scale(1.12)" : undefined}>
          <Shadow />
          <Bx h={22} c="#ffffff" />
          <g transform="translate(-10 -4) skewY(26.565)"><rect x="-7.5" y="-13" width="15" height="12" fill="#fff6dc" stroke="#d9a06a" strokeWidth="1.4" /><circle cx="-3" cy="-8" r="3" fill="#ff8fb1" /><polygon points="0,-3 6,-3 3,-10" fill="#7fe3c4" /></g>
          <polygon points="3,9 9,6 9,-2 3,1" fill="#2b2340" opacity=".8" />
          {L === 3 && <g transform="translate(28 8)"><Bx h={8} c="#c9bff0" k={0.3} /><circle cx="0" cy="-9" r="4.4" fill="#ff8fb1" /></g>}
        </g>
      );
    case "stars":
      if (L === 3)
        return (
          <g transform="scale(.6)">
            <rect x="-22" y="-24" width="44" height="28" fill="#efeaff" /><rect x="0" y="-24" width="22" height="28" fill="#d6cdf2" /><ellipse cx="0" cy="4" rx="22" ry="8" fill="#d6cdf2" />
            <path d="M-24 -24 A24 22 0 0 1 24 -24 Z" fill="#bfc8ec" /><path d="M0 -46 A24 22 0 0 1 24 -24 L0 -24 Z" fill="#a9b3dd" />
            <polygon points="-3,-46 4,-45.6 4,-24 -3,-24" fill="#4a4470" />
            <rect x="-3" y="-60" width="7" height="22" rx="3" fill="#7b66ee" transform="rotate(30 0 -40)" />
          </g>
        );
      return (
        <g>
          {L === 2 && <polygon points="-22,4 0,-7 22,4 0,15" fill="#e0b07a" stroke="#c98a5e" strokeWidth="2" {...round} />}
          <path d="M-6 8 L0 -10 L6 8 M0 -10 V8" stroke="#5a5470" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="-3" y="-26" width="6" height="18" rx="3" fill="#7b66ee" transform="rotate(35 0 -12)" />
          <path className="wa-blink" d="M14 -30 l1.2 2.6 l2.6 1.2 l-2.6 1.2 l-1.2 2.6 l-1.2 -2.6 l-2.6 -1.2 l2.6 -1.2 Z" fill="#ffd36b" />
        </g>
      );
    case "farm":
      if (L === 1)
        return (
          <g transform="rotate(14)">
            <g fill="#8a5a3c"><rect x="-20" y="-4" width="40" height="5" rx="2.5" /><rect x="-20" y="5" width="40" height="5" rx="2.5" /></g>
            <g fill="#7fd98a">{[-14, -5, 4, 13].map((x) => <circle key={x} cx={x} cy="-4" r="3" />)}{[-14, -5, 4, 13].map((x) => <circle key={x} cx={x} cy="5" r="3" />)}</g>
          </g>
        );
      return (
        <g transform="scale(.85)">
          {L === 3 && <g transform="translate(26 4)"><rect x="-7" y="-40" width="14" height="40" fill="#dfe4ec" /><rect x="2" y="-40" width="5" height="40" fill="#c4cbd6" /><path d="M-7 -40 A7 6 0 0 1 7 -40 Z" fill="#a9b3c2" /></g>}
          <g transform="translate(-6 0)"><Bx h={22} c="#e8665a" /><Roof y={-22} c="#8a5a3c" /><g transform="translate(4 8) skewY(-26.565)"><rect x="0" y="-13" width="11" height="13" fill="#fff4e4" /><path d="M0 -13 L11 0 M11 -13 L0 0" stroke="#e8665a" strokeWidth="1.4" /></g></g>
        </g>
      );
    case "fun":
      if (L === 3) return <g transform="scale(.75)"><FerrisWheel /></g>;
      if (L === 2)
        return (
          <g>
            <ellipse cx="0" cy="2" rx="22" ry="9" fill="#efeaff" />
            <path d="M-18 0 V-22 M18 0 V-22 M-6 6 V-18 M6 6 V-18" stroke="#ffd36b" strokeWidth="2" />
            <g fill="#ff8fb1"><ellipse cx="-12" cy="-4" rx="4" ry="3" /><ellipse cx="12" cy="-4" rx="4" ry="3" fill="#7fe3c4" /></g>
            <path d="M-24 -22 L0 -40 L24 -22 C14 -17 -14 -17 -24 -22 Z" fill="#ff8fb1" /><path d="M0 -40 L24 -22 C18 -19 10 -18 4 -18 Z" fill="#e87aa8" />
          </g>
        );
      return (
        <g>
          <path d="M-12 6 L-8 -26 L8 -26 L12 6" stroke="#c98a5e" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
          <path d="M-8 -26 H8" stroke="#c98a5e" strokeWidth="2.4" />
          <path d="M-3 -26 V-6 M3 -26 V-6" stroke="#9c7a6a" strokeWidth="1" /><rect x="-5" y="-7" width="10" height="2.6" rx="1.3" fill="#ff8fb1" />
        </g>
      );
    case "love":
      if (L === 1)
        return (
          <g>
            <g transform="translate(0 6)"><rect x="-13" y="-7" width="26" height="3.4" rx="1.7" fill="#c98a5e" /><rect x="-13" y="-14" width="26" height="3" rx="1.5" fill="#c98a5e" /><path d="M-10 -4 V2 M10 -4 V2" stroke="#9c6a42" strokeWidth="1.8" /></g>
            <path d="M0 -18 c-2 -3 -6 -1 -4 2 l4 4 l4 -4 c2 -3 -2 -5 -4 -2 Z" fill="#ff6b8a" />
          </g>
        );
      return <g transform="scale(.8)"><Gazebo lights={L === 3} /></g>;
    case "childhood":
      if (L === 1)
        return (
          <g>
            <path d="M-16 6 L-10 -24 L10 -24 L16 6" stroke="#ff8f7a" strokeWidth="2.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M-4 -24 V-6 M4 -24 V-6" stroke="#9c7a6a" strokeWidth="1" /><rect x="-6" y="-7" width="12" height="2.6" rx="1.3" fill="#7fb2ff" />
          </g>
        );
      return <Treehouse g={g} k={L === 2 ? 0.62 : 0.75} />;
  }
}

/** A bus, along x */
function BusArt({ c }: { c: string }) {
  const r = shade(c, 0.86);
  return (
    <g>
      <ellipse cx="-18" cy="-1" rx="4.2" ry="4.2" fill="#3a3352" /><ellipse cx="4" cy="10" rx="4.2" ry="4.2" fill="#3a3352" />
      <polygon points="-28,-6 12,14 12,-4 -28,-24" fill={c} stroke={c} strokeWidth="2" {...round} />
      <polygon points="12,14 28,6 28,-12 12,-4" fill={r} stroke={r} strokeWidth="2" {...round} />
      <polygon points="-28,-24 -12,-32 28,-12 12,-4" fill={shade(c, 1.15)} stroke={shade(c, 1.15)} strokeWidth="2" {...round} />
      <polygon points="-28,-10 12,10 12,7 -28,-13" fill="#fff" />
      <g fill="#cfeaff"><polygon points="-25,-15 -19,-12 -19,-18 -25,-21" /><polygon points="-17,-11 -11,-8 -11,-14 -17,-17" /><polygon points="-9,-7 -3,-4 -3,-10 -9,-13" /><polygon points="-1,-3 5,0 5,-6 -1,-9" /></g>
      <polygon points="14,4 26,-2 26,-9 14,-3" fill="#a9d4f5" />
    </g>
  );
}
/** A car, along x */
function CarArt({ c }: { c: string }) {
  const r = shade(c, 0.84);
  const t = shade(c, 1.15);
  return (
    <g>
      <polygon points="-17,-1.5 3,8.5 3,2.5 -17,-7.5" fill={c} stroke={c} strokeWidth="3" {...round} />
      <polygon points="3,8.5 17,1.5 17,-4.5 3,2.5" fill={r} stroke={r} strokeWidth="3" {...round} />
      <polygon points="-17,-7.5 -3,-14.5 17,-4.5 3,2.5" fill={t} stroke={t} strokeWidth="3" {...round} />
      <polygon points="-13.1,-6.95 -3.1,-1.95 -5.6,-9.2 -12.1,-12.45" fill={c} stroke={c} strokeWidth="2" {...round} />
      <polygon points="-12,-7.6 -4.6,-3.9 -6.2,-8.6 -11.3,-11.2" fill="#d6eeff" />
      <polygon points="-3.1,-1.95 8.1,-7.55 5.6,-14.8 -5.6,-9.2" fill="#9fcdf2" stroke="#9fcdf2" strokeWidth="1.5" {...round} />
      <polygon points="-12.1,-12.45 -.9,-18.05 5.6,-14.8 -5.6,-9.2" fill={t} stroke={t} strokeWidth="2" {...round} />
      <ellipse cx="-13" cy="-.4" rx="3.4" ry="3.8" fill="#2e2840" /><ellipse cx="-1" cy="5.6" rx="3.4" ry="3.8" fill="#2e2840" />
      <ellipse cx="5.6" cy="4.2" rx="1.6" ry="1.1" fill="#fff6c8" /><ellipse cx="14.4" cy="-.2" rx="1.6" ry="1.1" fill="#fff6c8" />
    </g>
  );
}
function TrainCar({ engine }: { engine?: boolean }) {
  if (engine)
    return (
      <g>
        <polygon points="-14.4,7.2 23.6,26.2 23.6,20.2 17.6,11.2 -14.4,-4.8" fill="#fff6ea" stroke="#fff6ea" strokeWidth="2" {...round} />
        <polygon points="23.6,26.2 38,19 38,13 32,4 17.6,11.2 23.6,20.2" fill="#ff6b8a" stroke="#ff6b8a" strokeWidth="2" {...round} />
        <polygon points="19.2,12.4 32,6 35.6,11.6 22.8,18" fill="#4a5a86" />
        <polygon points="0,-12 32,4 17.6,11.2 -14.4,-4.8" fill="#c9c2d9" stroke="#c9c2d9" strokeWidth="2" {...round} />
        <polygon points="-12.4,3.2 14,16.4 14,12.4 -12.4,-.8" fill="#4a5a86" />
        <polygon points="-14.4,5.2 21,22.9 21,21.4 -14.4,3.7" fill="#ff6b8a" />
        <ellipse cx="26.5" cy="21.5" rx="1.6" ry="1.1" fill="#fff6c8" /><ellipse cx="35" cy="17" rx="1.6" ry="1.1" fill="#fff6c8" />
      </g>
    );
  return (
    <g>
      <polygon points="-14.4,7.2 17.6,23.2 17.6,11.2 -14.4,-4.8" fill="#fff6ea" stroke="#fff6ea" strokeWidth="2" {...round} />
      <polygon points="17.6,23.2 32,16 32,4 17.6,11.2" fill="#e9dccb" stroke="#e9dccb" strokeWidth="2" {...round} />
      <polygon points="0,-12 32,4 17.6,11.2 -14.4,-4.8" fill="#c9c2d9" stroke="#c9c2d9" strokeWidth="2" {...round} />
      <polygon points="-12.4,3.2 15.6,17.2 15.6,13.2 -12.4,-.8" fill="#4a5a86" />
      <polygon points="-14.4,5.2 17.6,21.2 17.6,19.7 -14.4,3.7" fill="#ff6b8a" />
    </g>
  );
}
const PLANE_TOP = (
  <g>
    <path d="M-14 0 C-14 -1.6 -12 -2 -10 -2 H10 C13 -2 15 -1 16 0 C15 1 13 2 10 2 H-10 C-12 2 -14 1.6 -14 0 Z" fill="#fff" />
    <path d="M0 -2 L-5 -14 H-2 L6 -2 Z M0 2 L-5 14 H-2 L6 2 Z" fill="#e3e9f5" />
    <path d="M-11 -1.6 L-14 -6 H-12 L-8 -1.6 Z M-11 1.6 L-14 6 H-12 L-8 1.6 Z" fill="#e3e9f5" />
    <path d="M-12 0 H12" stroke="#ff6b8a" strokeWidth=".9" />
  </g>
);
function Plane() {
  return (
    <g>
      <path d="M2 -5 L-8 -20 H-2 L12 -5 Z" fill="#cfd8ec" />
      <path d="M-30 0 C-30 -5 -25 -7 -17 -7 H18 C26 -7 32 -4 35 0 C32 4 26 5 18 5 H-17 C-25 5 -30 4 -30 0 Z" fill="#fff" />
      <path d="M-26 -.6 H31" stroke="#ff6b8a" strokeWidth="1.6" />
      <g fill="#7aa8e0">{[-18, -13, -8, -3, 2, 7, 12, 17].map((x) => <rect key={x} x={x} y="-4.6" width="2.6" height="2.4" rx="1" />)}</g>
      <path d="M27 -5 C30 -4 32 -2.4 33.4 -1 H27.4 Z" fill="#3a4a70" />
      <path d="M-20 -6 L-29 -22 Q-30 -24 -27 -24 H-24 Q-22 -24 -21 -22 L-11 -6 Z" fill="#ff6b8a" />
      <path d="M0 1 L-12 20 Q-12.6 22 -10 22 H-6 L14 1 Z" fill="#eef2fa" />
      <rect x="-6" y="8" width="12" height="5.6" rx="2.8" fill="#c9d3ea" />
    </g>
  );
}
function Balloon() {
  return (
    <g>
      <path d="M0 -6 C-22 -6 -28 -30 -24 -42 C-18 -62 18 -62 24 -42 C28 -30 22 -6 0 -6 Z" fill="#ff8fb1" />
      <path d="M0 -60 C-10 -48 -10 -18 0 -6 C10 -18 10 -48 0 -60 Z" fill="#ffd1df" />
      <path d="M-6 -6 L-5 4 M6 -6 L5 4" stroke="#9c7a6a" strokeWidth="1" />
      <rect x="-7" y="3" width="14" height="10" rx="3" fill="#c98a5e" />
    </g>
  );
}
function Sailboat({ c = "#ff9ec4" }: { c?: string }) {
  return (
    <g>
      <path d="M-24 0 H22 L16 10 H-18 Z" fill="#fff4e4" />
      <path d="M-22 3 H20" stroke="#ff8f7a" strokeWidth="2" />
      <path d="M-1 0 V-42" stroke="#b07a4c" strokeWidth="2" />
      <path d="M1 -40 C14 -30 18 -14 16 -4 H1 Z" fill="#fff" />
      <path d="M-3 -34 C-12 -24 -16 -12 -15 -4 H-3 Z" fill={c} />
    </g>
  );
}
function DreamIsle({ g }: { g: G }) {
  return (
    <g>
      <ellipse cx="0" cy="-2" rx="54" ry="22" fill="#fff" opacity=".22" />
      <path d="M-38 0 C-34 12 -22 22 -14 34 C-10 42 -4 52 0 60 C4 52 8 42 14 34 C22 22 32 12 38 0 Z" fill={g.rock} />
      <polygon points="-22,22 -18,10 -14,22" fill={g.crystal} /><polygon points="-14,22 -11,14 -8,22" fill={g.crystal} /><polygon points="12,30 16,18 20,30" fill={g.crystal} />
      <g stroke="#5cbf6a" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M-30 4 C-32 12 -28 18 -30 26" /><path d="M-6 8 C-8 16 -4 22 -6 32" /><path d="M30 6 C32 12 28 16 30 22" /></g>
      <ellipse cx="0" cy="-1" rx="40" ry="15" fill="#d9a77e" /><ellipse cx="0" cy="-4" rx="38" ry="13.5" fill="#a6e696" />
      <ellipse cx="22" cy="-4" rx="7" ry="2.8" fill={g.water} />
      <path className="wa-fall" d="M26 0 V44" stroke={g.fall} strokeWidth="5" strokeDasharray="6 3" strokeLinecap="round" />
      <path d="M-6 -6 V-20 A7 7 0 0 1 8 -20 V-6 H4 V-18 A3 3 0 0 0 -2 -18 V-6 Z" fill="#f4eaf8" />
      <polygon points="12,-6 15,-18 18,-6" fill={g.crystal} />
      <g transform="translate(-22 -6) scale(.8)"><RoundTree g={g} /></g>
    </g>
  );
}

function PropArt({ p, g, night, names, flip }: { p: Prop; g: G; night: boolean; names?: [string, string] | null; flip: boolean }) {
  switch (p.kind) {
    case "mountain":
      return <Mountain k={p.variant ? 0.8 : 1.05} />;
    case "snowpine":
      return <g transform="scale(.9)"><PineTree g={g} snow /></g>;
    case "pine":
      return <g transform="scale(.9)"><PineTree g={g} d="wa-d1" /></g>;
    case "tree":
      return <g transform="scale(.9)"><RoundTree g={g} d="wa-d2" /></g>;
    case "cactus":
      return <Cactus k={0.85} />;
    case "dune":
      return <g><path d="M-22 6 C-14 -8 0 -8 8 4 C-2 9 -14 9 -22 6 Z" fill="#f2c867" /><path d="M-4 10 C4 -2 18 -2 24 6 C16 11 4 12 -4 10 Z" fill="#e9b85a" /></g>;
    case "shrub":
      return (
        <g transform={`scale(${p.variant ? 0.9 : 1.1})`}><g className="wa-lf">
          <circle cx="0" cy="-7" r="7" fill={g.leaf} /><circle cx="-6" cy="-3" r="5" fill={g.leaf} /><circle cx="6" cy="-3" r="5" fill={g.leaf} />
        </g></g>
      );
    case "flowers":
      return <g>{[[-10, 0, "#ff8fb1"], [-2, -4, "#ffd36b"], [6, 1, "#fff"], [0, 5, "#b59cff"], [10, -3, "#ff8fb1"]].map(([x, y, c]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill={c as string} />)}</g>;
    case "palm":
      return <Palm g={g} />;
    case "parasol":
      return <g><path d="M0 0 V-16" stroke="#9c7a6a" strokeWidth="1.2" /><path d="M-11 -14 C-8 -22 8 -22 11 -14 Z" fill="#ff8fb1" /><path d="M-4 -14 C-3 -20 3 -20 4 -14 Z" fill="#fff" /></g>;
    case "cottage":
      return <g transform="scale(.9)"><Bx h={14} c="#eef5ff" /><Roof y={-14} c="#6fa6ff" /><WL x={-14} y={-1} c={night ? "#ffd36b" : "#ffb84a"} /></g>;
    case "lighthouse":
      return (
        <g transform="scale(.85)">
          <polygon className="wa-blink" points="0,-56 70,-74 70,-40" fill="#fff6c8" opacity=".7" />
          <polygon points="-11,0 11,0 8,-48 -8,-48" fill="#fff" /><polygon points="0,0 11,0 8,-48 0,-48" fill="#e9e4f0" />
          <polygon points="-10.3,-12 10.3,-12 9.6,-22 -9.6,-22" fill="#ff6b6b" /><polygon points="-9,-32 9,-32 8.4,-41 -8.4,-41" fill="#ff6b6b" />
          <rect x="-10" y="-50" width="20" height="3" rx="1.5" fill="#5a5470" /><rect x="-7" y="-60" width="14" height="10" rx="2" fill="#ffe08a" />
          <path d="M-10 -60 L0 -70 L10 -60 Z" fill="#ff6b6b" />
        </g>
      );
    case "volcano":
      return (
        <g>
          <polygon points="-30,6 -10,-34 12,-34 30,6 0,16" fill="#a8897c" stroke="#a8897c" strokeWidth="3" {...round} />
          <polygon points="0,16 30,6 12,-34 1,-34" fill="#7f655b" stroke="#7f655b" strokeWidth="3" {...round} />
          <ellipse cx="1" cy="-34" rx="11" ry="4" fill="#ff8a3d" /><ellipse cx="1" cy="-34" rx="7" ry="2.4" fill="#ffd36b" />
          <path d="M-3 -31 C-6 -20 1 -12 -3 -1 C-4 5 -1 10 -2 14" stroke="#ff7a2a" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <g fill="#efe8f0"><circle className="wa-rise" cx="3" cy="-44" r="5" /><circle cx="9" cy="-52" r="6" /></g>
        </g>
      );
    case "signpost":
      return (
        <g transform="scale(.8)">
          <path d="M0 8 V-48" stroke="#b07a4c" strokeWidth="4" strokeLinecap="round" />
          <path d="M-2 -44 H30 L36 -38 L30 -32 H-2 Z" fill="#ff8fb1" />
          <path d="M2 -28 H-30 L-36 -22 L-30 -16 H2 Z" fill="#8b78f0" />
          <g fontFamily="inherit" fontSize="9" fontWeight="900" fill="#fff" textAnchor="middle">
            <text x="15" y="-35">{(names?.[0] || "You").slice(0, 7)}</text>
            <text x="-15" y="-19">{(names?.[1] || "").slice(0, 7)}</text>
          </g>
        </g>
      );
    case "car":
      return <g className={flip ? "wa-ridey" : "wa-ride"}><g transform={`scale(${flip ? -0.7 : 0.7} .7)`}><CarArt c={p.color ?? "#7fb2ff"} /></g></g>;
    case "bus":
      return <g className={flip ? "wa-ridey" : "wa-ride"} style={{ animationDelay: "2s" }}><g transform={`scale(${flip ? -0.5 : 0.5} .5)`}><BusArt c={p.color === "#ffffff" ? "#ffb84a" : p.color ?? "#ffb84a"} /></g></g>;
    case "footbridge": {
      // Up and over the road: from the plot on one side to the plot on the other
      const v: P = flip ? [TILE / 2, TILE / 4] : [-TILE / 2, TILE / 4];
      const a: P = [-v[0] * 1.2, -v[1] * 1.2];
      const b: P = [v[0] * 1.2, v[1] * 1.2];
      return (
        <g>
          <g transform={`translate(${a[0]} ${a[1]}) scale(.32)`}><Bx h={70} c="#c9bff0" /></g>
          <g transform={`translate(${b[0]} ${b[1]}) scale(.32)`}><Bx h={70} c="#c9bff0" /></g>
          <path d={`M${a[0]} ${a[1] - 22} L${b[0]} ${b[1] - 22}`} stroke="#b5abd9" strokeWidth="7" strokeLinecap="round" />
          <path d={`M${a[0]} ${a[1] - 24} L${b[0]} ${b[1] - 24}`} stroke="#efeaff" strokeWidth="3.4" strokeLinecap="round" />
          <path d={`M${a[0]} ${a[1] - 30} L${b[0]} ${b[1] - 30}`} stroke="#ff8fb1" strokeWidth="1.2" />
        </g>
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------

/** The whole world, drawn on the sea. `view` places and zooms it, `rot` turns it. */
export const WorldArt = forwardRef<
  SVGSVGElement,
  {
    layout: WorldLayout;
    sky: Sky;
    names?: [string, string] | null;
    picked?: number | null;
    onPick?: (i: number) => void;
    rot?: number;
    view: WorldView;
    width: number;
    height: number;
    worldRef?: React.Ref<SVGGElement>;
    className?: string;
    style?: React.CSSProperties;
  }
>(function WorldArt({ layout, sky, names, picked, onPick, rot = 0, view, width, height, worldRef, className, style }, ref) {
  const raw = useId();
  const id = (s: string) => `w${raw.replace(/[^a-zA-Z0-9]/g, "")}${s}`;
  const u = (s: string) => `url(#${id(s)})`;
  const g = makeG(u);
  const night = sky === "night";
  const ext = worldExtent(layout, rot);
  const cx = (ext.minX + ext.maxX) / 2;

  // Everything in turned grid squares
  const T = (gx: number, gy: number) => turn(gx, gy, rot);
  const land = new Map<string, Tile>();
  const tiles = layout.tiles.map((t) => {
    const [rx, ry] = T(t.gx, t.gy);
    const tt = { ...t, rx, ry, ax: turnAxis(t.axis, rot) };
    land.set(key(rx, ry), t);
    return tt;
  });
  tiles.sort((a, b) => a.rx + a.ry - (b.rx + b.ry));
  const has = (rx: number, ry: number) => land.has(key(rx, ry));

  type Thing = { depth: number; key: string; node: React.ReactNode };
  const things: Thing[] = [];
  const at = (gx: number, gy: number) => {
    const [rx, ry] = T(gx, gy);
    return { rx, ry, p: proj(rx, ry) };
  };

  layout.pieces.forEach((pc, i) => {
    const { rx, ry, p } = at(pc.gx, pc.gy);
    things.push({
      depth: rx + ry,
      key: `p${i}`,
      node: (
        <g
          transform={`translate(${p[0]} ${p[1]}) scale(${pc.scale})`}
          onClick={
            onPick
              ? (e) => {
                  e.stopPropagation();
                  onPick(i);
                }
              : undefined
          }
          className={onPick ? "cursor-pointer" : undefined}
          opacity={picked != null && picked !== i ? 0.5 : 1}
        >
          <rect x="-30" y="-60" width="60" height="72" fill="transparent" />
          <PieceArt p={pc} g={g} night={night} />
          {picked === i && <ellipse cx="0" cy="2" rx="34" ry="17" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 4" />}
        </g>
      ),
    });
  });
  layout.props.forEach((pr, i) => {
    const { rx, ry, p } = at(pr.gx, pr.gy);
    const ax = turnAxis(pr.axis, rot);
    // Cars keep to their lane
    const lane: P = pr.kind === "car" || pr.kind === "bus" ? (ax === "x" ? [-5, 2.5] : [5, 2.5]) : [0, 0];
    things.push({
      depth: rx + ry + (pr.kind === "footbridge" ? 0.5 : pr.kind === "car" || pr.kind === "bus" ? 0.1 : 0),
      key: `r${i}`,
      node: <g transform={`translate(${p[0] + lane[0]} ${p[1] + lane[1]})`}><PropArt p={pr} g={g} night={night} names={names} flip={ax === "y"} /></g>,
    });
  });
  // The train: two carriages and an engine
  if (layout.train) {
    const ax = turnAxis("x", rot);
    [0, 1, 2].forEach((i) => {
      const { rx, ry, p } = at(layout.train!.gx + (i - 1) * 0.9, layout.train!.gy);
      if (!has(Math.round(rx), Math.round(ry))) return;
      things.push({
        depth: rx + ry + 0.2,
        key: `tr${i}`,
        node: (
          <g transform={`translate(${p[0]} ${p[1]}) ${ax === "y" ? "scale(-1 1)" : ""} translate(-8.8 -11.6)`}>
            <TrainCar engine={i === 2} />
          </g>
        ),
      });
    });
  }
  // The airport: runway, terminal, tower and a parked plane
  if (layout.airport) {
    const { rx, ry, p } = at(layout.airport.gx + 1, layout.airport.gy + 1);
    const flip = rot % 2 === 1;
    things.push({
      depth: rx + ry - 0.6,
      key: "air",
      node: (
        <g transform={`translate(${p[0]} ${p[1]}) ${flip ? "scale(-1 1)" : ""}`}>
          <g transform={`matrix(${TILE} ${TILE / 2} ${-TILE} ${TILE / 2} 0 0)`}>
            <rect x="-1.4" y="-1.35" width="2.8" height=".9" rx=".12" fill="#8e86a8" />
            <path d="M-1.1 -.9 H1.1" stroke="#fff" strokeWidth=".04" strokeDasharray=".25 .2" />
            <rect x="-.15" y="-.45" width=".3" height=".4" fill="#b3abc8" />
            <rect x="-1" y=".2" width="1.9" height=".7" rx=".1" fill="#e2dcec" />
          </g>
          <g transform="matrix(1.1 .55 -1.1 .55 44 -14)">{PLANE_TOP}</g>
          <polygon points="-62,-1 -14,23 -14,11 -62,-13" fill="#eef2fb" stroke="#eef2fb" strokeWidth="2" {...round} />
          <polygon points="-14,23 2,15 2,3 -14,11" fill="#cfd6ea" stroke="#cfd6ea" strokeWidth="2" {...round} />
          <polygon points="-46,-21 2,3 -14,11 -62,-13" fill="#fff" stroke="#fff" strokeWidth="2" {...round} />
          <polygon points="-60,-3 -16,19 -16,14 -60,-8" fill={night ? "#ffd36b" : "#8fc6f0"} />
          <g transform="translate(14 30) scale(.8)">
            <rect x="-4" y="-34" width="8" height="34" fill="#efeaff" /><rect x="0" y="-34" width="4" height="34" fill="#d6cdf2" />
            <path d="M-9 -34 H9 L7 -44 H-7 Z" fill="#a9d4f5" /><path d="M-9 -44 H9 L0 -50 Z" fill="#8b78f0" />
            <circle className="wa-blink" cx="0" cy="-53" r="1.8" fill="#ff6b6b" />
          </g>
        </g>
      ),
    });
  }
  // The ferry beside the pier
  if (layout.pier) {
    const { rx, ry, p } = at(layout.pier.ferry.gx, layout.pier.ferry.gy);
    const flip = rot % 2 === 1;
    const hull = "M-.55 -.2 H.35 C.5 -.2 .6 -.08 .65 0 C.6 .08 .5 .2 .35 .2 H-.55 Q-.6 .2 -.6 .15 V-.15 Q-.6 -.2 -.55 -.2 Z";
    things.push({
      depth: rx + ry,
      key: "ferry",
      node: (
        <g transform={`translate(${p[0]} ${p[1] + 8}) ${flip ? "scale(-1 1)" : ""}`}>
          <g className="wa-bob">
            {([[9, "#3f74c6"], [6, "#6fa6ff"], [3, "#ffffff"], [0, "#f6efe4"]] as [number, string][]).map(([dy, c]) => (
              <path key={dy} d={hull} transform={`translate(0 ${dy}) matrix(${TILE} ${TILE / 2} ${-TILE} ${TILE / 2} 0 0)`} fill={c} />
            ))}
            <g transform="translate(-6 -4) scale(.45)"><Bx h={14} c="#ffffff" /><WL x={-15} y={-1} c="#7fb2ff" /><WR x={5} y={3} c="#7fb2ff" /></g>
            <g transform="translate(-10 -16)"><rect x="-3" y="-10" width="6" height="10" fill="#ff6b6b" /><rect x="-3" y="-7" width="6" height="2" fill="#fff" /></g>
          </g>
        </g>
      ),
    });
  }
  things.sort((a, b) => a.depth - b.depth);

  // Sky things sit around the top of the world
  const top = ext.minY;
  const sea = SEA[sky];
  const pad = Math.max(ext.maxX - ext.minX, ext.maxY - ext.minY) * 1.5 + 2000;

  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg" className={className} style={style} role="img" aria-label={`Your world: ${layout.total} messages`}>
      <defs>
        <Defs id={id} />
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sea[0]} /><stop offset="1" stopColor={sea[1]} /></linearGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
        <style>{ANIM}</style>
      </defs>
      <rect width={width} height={height} fill={u("sea")} />

      <g ref={worldRef} transform={`translate(${view.x} ${view.y}) scale(${view.s})`} style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
        {/* Waves */}
        <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity={night ? 0.18 : 0.5} className="wa-drift">
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * 2.399) % (Math.PI * 2);
            const r = 0.62 + ((i * 37) % 100) / 150;
            const w = (ext.maxX - ext.minX) / 2;
            const h = (ext.maxY - ext.minY) / 2;
            return <path key={i} d={`M${cx + Math.cos(a) * w * r * 1.25} ${(ext.minY + ext.maxY) / 2 + Math.sin(a) * h * r * 1.35} q6 -5 12 0 q6 -5 12 0`} />;
          })}
        </g>
        {night && (
          <g fill="#fff">
            {Array.from({ length: 30 }, (_, i) => (
              <circle key={i} className={i % 3 ? undefined : "wa-blink"} cx={cx + (((hash(`st${i}`) % 2000) / 1000 - 1) * (ext.maxX - ext.minX))} cy={top - 40 - (hash(`sy${i}`) % 260)} r={1 + (i % 3) * 0.4} />
            ))}
          </g>
        )}

        {/* Foam, then cliffs, then the ground */}
        <g fill="none" stroke="#fff" strokeWidth="5" opacity={night ? 0.25 : 0.55}>
          {tiles.map((t) => {
            const [x, y] = proj(t.rx, t.ry);
            const R: P = [x + TILE, y];
            const B: P = [x, y + TILE / 2];
            const Lp: P = [x - TILE, y];
            return (
              <g key={`f${t.rx},${t.ry}`}>
                {!has(t.rx + 1, t.ry) && <path d={`M${R[0]} ${R[1] + CLIFF + 6} L${B[0]} ${B[1] + CLIFF + 6}`} />}
                {!has(t.rx, t.ry + 1) && <path d={`M${B[0]} ${B[1] + CLIFF + 6} L${Lp[0]} ${Lp[1] + CLIFF + 6}`} />}
              </g>
            );
          })}
        </g>
        {tiles.map((t) => {
          const [x, y] = proj(t.rx, t.ry);
          const R: P = [x + TILE, y];
          const B: P = [x, y + TILE / 2];
          const Lp: P = [x - TILE, y];
          const sand = t.biome === "sand";
          return (
            <g key={`c${t.rx},${t.ry}`}>
              {!has(t.rx + 1, t.ry) && <polygon points={pts(R, B, [B[0], B[1] + CLIFF], [R[0], R[1] + CLIFF])} fill={sand ? "#d9a56a" : night ? "#6e4a3a" : "#a56a46"} stroke={sand ? "#d9a56a" : night ? "#6e4a3a" : "#a56a46"} strokeWidth="1" />}
              {!has(t.rx, t.ry + 1) && <polygon points={pts(B, Lp, [Lp[0], Lp[1] + CLIFF], [B[0], B[1] + CLIFF])} fill={sand ? "#e8b87a" : night ? "#8a5d48" : "#c9855a"} stroke={sand ? "#e8b87a" : night ? "#8a5d48" : "#c9855a"} strokeWidth="1" />}
            </g>
          );
        })}
        {tiles.map((t) => (
          <TileArt key={`t${t.rx},${t.ry}`} t={t} rx={t.rx} ry={t.ry} ax={t.ax} has={has} g={g} night={night} />
        ))}

        {/* Beaches along the coast */}
        <g fill="none" stroke={night ? "#cdb386" : "#f6e2a6"} strokeWidth="4" strokeLinecap="round">
          {tiles.map((t) => {
            const [x, y] = proj(t.rx, t.ry);
            const Tp: P = [x, y - TILE / 2];
            const R: P = [x + TILE, y];
            const B: P = [x, y + TILE / 2];
            const Lp: P = [x - TILE, y];
            const e: string[] = [];
            if (!has(t.rx + 1, t.ry)) e.push(`M${R[0]} ${R[1]} L${B[0]} ${B[1]}`);
            if (!has(t.rx, t.ry + 1)) e.push(`M${B[0]} ${B[1]} L${Lp[0]} ${Lp[1]}`);
            if (!has(t.rx - 1, t.ry)) e.push(`M${Lp[0]} ${Lp[1]} L${Tp[0]} ${Tp[1]}`);
            if (!has(t.rx, t.ry - 1)) e.push(`M${Tp[0]} ${Tp[1]} L${R[0]} ${R[1]}`);
            return e.length ? <path key={`s${t.rx},${t.ry}`} d={e.join(" ")} /> : null;
          })}
        </g>

        {/* The lake in the forest */}
        {(() => {
          const lake = layout.tiles.filter((t) => t.kind === "lake");
          if (lake.length < 9) return null;
          const gx = lake.reduce((s, t) => s + t.gx, 0) / 9;
          const gy = lake.reduce((s, t) => s + t.gy, 0) / 9;
          const [x, y] = proj(...T(gx, gy));
          return (
            <g transform={`translate(${x} ${y})`}>
              <ellipse rx="96" ry="46" fill={g.water} stroke={night ? "#cdb386" : "#f3e3b0"} strokeWidth="5" />
              <path d="M-40 -14 q10 -5 20 0 M10 12 q10 -5 20 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7" />
              <ellipse cx="-30" cy="10" rx="8" ry="4" fill="#5cc46a" /><ellipse cx="34" cy="-8" rx="7" ry="3.4" fill="#5cc46a" /><circle cx="34" cy="-9" r="1.8" fill="#ff8fb1" />
            </g>
          );
        })()}
        {/* The pier, over the sea */}
        {layout.pier && (
          <g>
            {layout.pier.tiles.map((pt, i) => {
              const [rx, ry] = T(pt.gx, pt.gy);
              const c = proj(rx, ry);
              const ax = turnAxis("x", rot);
              return (
                <g key={i}>
                  <path d={`M${c[0]} ${c[1] + 6} V${c[1] + 20}`} stroke="#9c6a42" strokeWidth="2.6" strokeLinecap="round" />
                  <polygon points={strip(c, ax, 0.22)} fill="#e0b07a" stroke="#c98a5e" strokeWidth="1" />
                  <path d={line(c, ax)} stroke="#c98a5e" strokeWidth="12" strokeDasharray="1 4" opacity=".7" />
                </g>
              );
            })}
            {(() => {
              const a = proj(...T(layout.pier.ferry.gx, layout.pier.ferry.gy));
              const b = proj(...T(layout.pier.to.gx, layout.pier.to.gy));
              return <path d={`M${a[0]} ${a[1] + 10} Q${(a[0] + b[0]) / 2} ${Math.max(a[1], b[1]) + 30} ${b[0]} ${b[1] + 10}`} stroke="#fff" strokeWidth="2.4" fill="none" strokeDasharray="6 7" strokeLinecap="round" opacity=".85" />;
            })()}
          </g>
        )}

        {/* Island names */}
        {layout.islands.map((isl) => {
          const [x, y] = proj(...T(isl.gx, isl.gy));
          return (
            <g key={isl.id} transform={`translate(${x} ${y + isl.r * TILE * 0.5 + 44})`} pointerEvents="none">
              <rect x={-isl.name.length * 3.6 - 10} y="-11" width={isl.name.length * 7.2 + 20} height="22" rx="11" fill="#fff" opacity=".92" />
              <text textAnchor="middle" y="4" fontSize="11.5" fontWeight="900" fill="#4a3f60">{isl.name}</text>
            </g>
          );
        })}

        {things.map((t) => (
          <g key={t.key}>{t.node}</g>
        ))}

        {/* Out at sea and up in the sky */}
        {Array.from({ length: layout.boats }, (_, i) => (
          <g key={`boat${i}`} transform={`translate(${i ? ext.minX + 30 : ext.maxX - 40} ${i ? ext.maxY - 20 : (ext.minY + ext.maxY) / 2 + 40}) scale(.6)`}>
            <g className="wa-bob" style={{ animationDelay: `${i * 0.8}s` }}><Sailboat c={i ? "#7fb2ff" : "#ff9ec4"} /></g>
          </g>
        ))}
        <g className="wa-drift" fill="#fff" opacity={night ? 0.25 : 0.9}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${cx + (i - 1) * (ext.maxX - ext.minX) * 0.35} ${top - 30 - (i % 2) * 40}) scale(${0.7 + (i % 2) * 0.3})`}>
              <ellipse rx="34" ry="11" /><circle cx="-10" cy="-8" r="12" /><circle cx="10" cy="-10" r="14" />
            </g>
          ))}
        </g>
        {!night && <g transform={`translate(${ext.maxX - 30} ${top - 70})`}><circle r="44" fill="#fff3b0" opacity=".35" /><circle r="26" fill={g.sun} /></g>}
        {night && <g transform={`translate(${ext.maxX - 30} ${top - 70})`}><circle r="40" fill="#cfd8ff" opacity=".15" /><circle r="22" fill="#fffbe8" /><circle cx="-6" cy="-5" r="4" fill="#ddd3b4" /></g>}
        {layout.dreamIsle && <g transform={`translate(${ext.minX + 60} ${top - 90}) scale(1.1)`}><g className="wa-bob"><DreamIsle g={g} /></g></g>}
        {layout.balloon && <g transform={`translate(${cx - (ext.maxX - ext.minX) * 0.18} ${top - 40}) scale(.75)`}><g className="wa-bob" style={{ animationDelay: "1s" }}><Balloon /></g></g>}
        {layout.plane && (
          <g transform={`translate(${cx + (ext.maxX - ext.minX) * 0.25} ${top - 110})`}><g className="wa-bob" style={{ animationDelay: ".5s" }}>
            <path d="M-40 18 C-80 26 -130 34 -180 38" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="7 6" opacity=".8" />
            <g transform="rotate(-12) scale(1.2)"><Plane /></g>
          </g></g>
        )}
        {Array.from({ length: layout.birds }, (_, i) => (
          <path key={`bd${i}`} d={`M${cx - 120 + i * 40} ${top - 20 - (i % 2) * 22} q5 -5 10 0 q5 -5 10 0`} stroke={night ? "#c9d3f0" : "#2b3550"} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ))}

        {/* Fog that clears as you talk (masked chats) */}
        {layout.fog > 0.02 && (
          <g filter={`url(#${id("blur")})`} fill="#ffffff" opacity={layout.fog} pointerEvents="none">
            {[[-0.3, -0.2], [0.3, 0.2], [0, 0.45], [0, -0.45]].map(([a, b], i) => (
              <ellipse key={i} cx={cx + a * (ext.maxX - ext.minX)} cy={(ext.minY + ext.maxY) / 2 + b * (ext.maxY - ext.minY)} rx={(ext.maxX - ext.minX) * 0.38} ry={(ext.maxY - ext.minY) * 0.32} />
            ))}
          </g>
        )}
        {/* Dim everything a little at sunset and night */}
        {sky !== "day" && <rect x={cx - pad} y={ext.minY - pad} width={pad * 2} height={pad * 2} fill={night ? "#1b2466" : "#ff9a6a"} opacity={night ? 0.32 : 0.12} pointerEvents="none" style={{ mixBlendMode: "multiply" }} />}
      </g>
    </svg>
  );
});

/** One square of ground: grass, road, river, bridge or railway */
function TileArt({ t, rx, ry, ax, has, g, night }: { t: Tile; rx: number; ry: number; ax: Axis; has: (rx: number, ry: number) => boolean; g: G; night: boolean }) {
  const c = proj(rx, ry);
  const tone = hash(`g${t.gx},${t.gy}`) % 2;
  let ground = GROUND[t.biome][tone];
  if (night) ground = shade(ground, 0.78);
  const base = <polygon points={diamond(c)} fill={ground} stroke={ground} strokeWidth="0.8" />;
  const road = night ? "#a49cc0" : "#e2dcec";
  const water = (axis: Axis, from = -0.5, to = 0.5) => (
    <>
      <polygon points={strip(c, axis, 0.34, from, to)} fill={night ? "#cdb386" : "#f3e3b0"} />
      <polygon points={strip(c, axis, 0.25, from, to)} fill="#5ab8ec" />
      <polygon points={strip(c, axis, 0.1, from, to)} fill="#9fdcff" />
      <path className="wa-flow" d={line(c, axis, from, to)} stroke="#fff" strokeWidth="1.4" strokeDasharray="4 18" strokeLinecap="round" />
    </>
  );
  switch (t.kind) {
    case "road":
      return (
        <g>
          <polygon points={diamond(c)} fill={road} stroke={road} strokeWidth="0.8" />
          {ax !== "both" ? <path d={line(c, ax)} stroke="#fff" strokeWidth="1.6" strokeDasharray="5 5" /> : <polygon points={diamond(c, 0.5)} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 2" opacity=".8" />}
        </g>
      );
    case "river":
    case "spring": {
      // Which way is downstream, and does the river fall off the edge here?
      const from = t.kind === "spring" ? 0 : -0.5;
      const fallFront = t.fall && ((ax === "y" && !has(rx, ry + 1)) || (ax === "x" && !has(rx + 1, ry)));
      const e = ax === "y" ? [c[0] - TILE / 2, c[1] + TILE / 4] : [c[0] + TILE / 2, c[1] + TILE / 4];
      const w: P = ax === "y" ? [TILE * 0.25, TILE * 0.125] : [-TILE * 0.25, TILE * 0.125];
      return (
        <g>
          {base}
          {water(ax, from, 0.5)}
          {t.kind === "spring" && <ellipse cx={c[0]} cy={c[1]} rx="14" ry="7" fill={g.water} stroke={night ? "#cdb386" : "#f3e3b0"} strokeWidth="2.4" />}
          {fallFront && (
            <g>
              <polygon points={pts([e[0] - w[0], e[1] - w[1]], [e[0] + w[0], e[1] + w[1]], [e[0] + w[0], e[1] + w[1] + CLIFF + 2], [e[0] - w[0], e[1] - w[1] + CLIFF + 2])} fill="#7fcbf2" />
              <path className="wa-fall" d={`M${e[0] - 4} ${e[1]} v${CLIFF} M${e[0] + 4} ${e[1] + 2} v${CLIFF}`} stroke="#fff" strokeWidth="1.6" strokeDasharray="5 4" />
              <g fill="#fff"><ellipse cx={e[0]} cy={e[1] + CLIFF + 4} rx="11" ry="3.6" /><circle cx={e[0] - 8} cy={e[1] + CLIFF + 2} r="2.6" /><circle cx={e[0] + 8} cy={e[1] + CLIFF + 3} r="2.6" /></g>
            </g>
          )}
        </g>
      );
    }
    case "bridge": {
      const across: Axis = ax === "y" ? "x" : "y";
      return (
        <g>
          {base}
          {water(ax)}
          <polygon points={strip(c, across, 0.3)} fill={road} transform="translate(0 -3)" />
          <polygon points={strip(c, across, 0.3)} fill="none" stroke="#e2c49c" strokeWidth="3" transform="translate(0 0)" opacity=".8" />
          <path d={line(c, across)} stroke="#fff" strokeWidth="1.6" strokeDasharray="5 5" transform="translate(0 -3)" />
        </g>
      );
    }
    case "rail":
    case "crossing": {
      const sleepers = (
        <>
          <path d={line(c, ax)} stroke="#c9a07a" strokeWidth="13" strokeDasharray="2.4 5.6" />
          <polygon points={strip(c, ax, 0.12)} fill="none" stroke="#7d6a78" strokeWidth="1.4" />
        </>
      );
      return (
        <g>
          {t.kind === "crossing" ? <polygon points={diamond(c)} fill={road} stroke={road} strokeWidth="0.8" /> : base}
          {sleepers}
        </g>
      );
    }
    default:
      return base;
  }
}

/** A single piece on its own, for the card you see when you tap it */
export function PiecePicture({ p, size = 88 }: { p: Piece; size?: number }) {
  const raw = useId();
  const id = (s: string) => `pp${raw.replace(/[^a-zA-Z0-9]/g, "")}${s}`;
  const g = makeG((s) => `url(#${id(s)})`);
  return (
    <svg viewBox="-46 -78 92 96" width={size} height={size} aria-hidden="true">
      <defs><Defs id={id} /><style>{ANIM}</style></defs>
      <ellipse cx="0" cy="6" rx="38" ry="15" fill="#c98a5e" />
      <ellipse cx="0" cy="2" rx="38" ry="15" fill="#a6e696" />
      <PieceArt p={p} g={g} night={false} />
    </svg>
  );
}
