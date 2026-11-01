"use client";

import { forwardRef, useId } from "react";
import type { IslandLayout, Piece } from "@/lib/island";

type Sky = "day" | "sunset" | "night";
type P = [number, number];

const SKIES: Record<Sky, { top: string; bottom: string; seaTop: string; seaBottom: string }> = {
  day: { top: "#4fb8f2", bottom: "#cdf1ff", seaTop: "#3cc4d9", seaBottom: "#136a9c" },
  sunset: { top: "#3b2a6b", bottom: "#ffbf80", seaTop: "#4fa2c4", seaBottom: "#1b4f7a" },
  night: { top: "#0b1230", bottom: "#28325f", seaTop: "#1a3a63", seaBottom: "#081834" },
};

/** Lighten (k > 1) or darken (k < 1) a colour */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---- A little 3D toolkit: boxes, roofs and windows seen from above at an angle ----
const pts = (...ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const lift = (p: P, h: number): P => [p[0], p[1] - h];
/** The four ground corners of a box: a = depth (left side), b = width (right side) */
function corners(a: number, b: number) {
  return {
    F: [b / 2 - a / 2, a / 4 + b / 4] as P,
    B: [a / 2 - b / 2, -(a / 4 + b / 4)] as P,
    L: [-a / 2 - b / 2, a / 4 - b / 4] as P,
    R: [a / 2 + b / 2, b / 4 - a / 4] as P,
  };
}
function Box({ a, b, h, z = 0, left, right, top }: { a: number; b: number; h: number; z?: number; left: string; right: string; top: string }) {
  const { F, B, L, R } = corners(a, b);
  return (
    <g>
      <polygon points={pts(lift(L, z), lift(F, z), lift(F, z + h), lift(L, z + h))} fill={left} />
      <polygon points={pts(lift(F, z), lift(R, z), lift(R, z + h), lift(F, z + h))} fill={right} />
      <polygon points={pts(lift(L, z + h), lift(F, z + h), lift(R, z + h), lift(B, z + h))} fill={top} />
    </g>
  );
}
/** A window (or door, or stripe) on the left or right wall of a box */
function Win({ side, a, b, u0, u1, v0, v1, z = 0, fill }: { side: "l" | "r"; a: number; b: number; u0: number; u1: number; v0: number; v1: number; z?: number; fill: string }) {
  const { F, L, R } = corners(a, b);
  const [s0, s1] = side === "l" ? [L, F] : [F, R];
  const at = (u: number, v: number): P => lift([s0[0] + (s1[0] - s0[0]) * u, s0[1] + (s1[1] - s0[1]) * u], z + v);
  return <polygon points={pts(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1))} fill={fill} />;
}
/** A pointed roof on top of a box */
function Roof({ a, b, h, rise, color }: { a: number; b: number; h: number; rise: number; color: string }) {
  const { F, L, R } = corners(a + 5, b + 5);
  const top: P = [0, -h - rise];
  return (
    <g>
      <polygon points={pts(lift(L, h), lift(F, h), top)} fill={color} />
      <polygon points={pts(lift(F, h), lift(R, h), top)} fill={shade(color, 0.76)} />
      <polyline points={pts(lift(L, h), lift(F, h), lift(R, h))} fill="none" stroke={shade(color, 0.6)} strokeWidth="1.2" />
    </g>
  );
}
function Shadow({ rx, ry = rx / 3 }: { rx: number; ry?: number }) {
  return <ellipse cx="0" cy="2" rx={rx} ry={ry} fill="#0b2a1a" opacity=".18" />;
}

/**
 * The islands, drawn: one or more islands joined by bridges, on the sea, under the sky.
 * `crop` shows just part of it (a viewBox). Tap a piece to see the message that made it.
 */
export const IslandArt = forwardRef<
  SVGSVGElement,
  {
    layout: IslandLayout;
    sky: Sky;
    names?: [string, string] | null;
    picked?: string | null;
    onPick?: (key: string) => void;
    crop?: string;
    className?: string;
    style?: React.CSSProperties;
  }
>(function IslandArt({ layout, sky, names, picked, onPick, crop, className, style }, ref) {
  const raw = useId();
  const id = (s: string) => `i${raw.replace(/[^a-zA-Z0-9]/g, "")}${s}`;
  const u = (s: string) => `url(#${id(s)})`;
  const c = SKIES[sky];
  const night = sky === "night";
  const W = layout.width;
  const last = layout.islands[layout.islands.length - 1];

  return (
    <svg
      ref={ref}
      viewBox={crop ?? `0 0 ${W} 844`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio={crop ? "xMidYMid slice" : "xMinYMid meet"}
      className={className}
      style={style}
      role="img"
      aria-label={`Your island: ${layout.total} messages`}
    >
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.top} /><stop offset="1" stopColor={c.bottom} /></linearGradient>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.seaTop} /><stop offset="1" stopColor={c.seaBottom} /></linearGradient>
        <radialGradient id={id("grass")} cx=".45" cy=".4" r=".7"><stop offset="0" stopColor={night ? "#7cb55e" : "#b9ee86"} /><stop offset="1" stopColor={night ? "#3e7c3d" : "#5fb553"} /></radialGradient>
        <linearGradient id={id("cliff")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c48a56" /><stop offset=".55" stopColor="#9c6439" /><stop offset="1" stopColor="#6e4026" /></linearGradient>
        <linearGradient id={id("lh")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c7cfdb" /></linearGradient>
        <linearGradient id={id("wood")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dca46a" /><stop offset="1" stopColor="#a86b3c" /></linearGradient>
        <radialGradient id={id("glow")}><stop offset="0" stopColor="#ffe9a8" stopOpacity=".95" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        <radialGradient id={id("sun")} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff4cc" /><stop offset=".5" stopColor="#ffd06e" /><stop offset="1" stopColor="#ffd06e" stopOpacity="0" /></radialGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        <path id={id("isl")} d="M38 468 C34 432 92 400 158 396 C206 392 248 388 292 404 C336 420 360 446 352 476 C344 508 300 540 236 548 C182 556 118 552 78 528 C50 512 40 492 38 468 Z" />
      </defs>

      {/* Sky */}
      <rect width={W} height="844" fill={u("sky")} />
      {night ? (
        <g fill="#fff">
          {Array.from({ length: Math.round(W / 12) }, (_, i) => (
            <circle key={i} cx={(i * 97) % W} cy={30 + ((i * 53) % 280)} r={i % 3 ? 1.1 : 1.7} opacity={0.5 + (i % 4) * 0.12} />
          ))}
          <circle cx={W - 90} cy="150" r="18" fill="#fdf6d8" />
          <circle cx={W - 82} cy="144" r="16" fill={c.top} />
        </g>
      ) : (
        <>
          <circle cx={W - 100} cy={sky === "day" ? 180 : 300} r="74" fill={u("sun")} />
          <g fill="#fff" opacity=".9">
            {Array.from({ length: Math.ceil(W / 260) }, (_, i) => (
              <Cloud key={i} x={70 + i * 260} y={170 + (i % 2) * 50} s={i % 2 ? 0.8 : 1.05} />
            ))}
          </g>
        </>
      )}
      {Array.from({ length: layout.birds }, (_, i) => (
        <path key={i} d={`M${60 + i * 58} ${232 - (i % 2) * 26} q5 -5 10 0 q5 -5 10 0`} stroke={night ? "#c9d3f0" : "#3b2a3f"} strokeWidth="2" fill="none" />
      ))}

      {/* Sea */}
      <rect y="330" width={W} height="514" fill={u("sea")} />
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity={night ? 0.18 : 0.32}>
        {Array.from({ length: Math.round(W / 40) }, (_, i) => (
          <path key={i} d={`M${(i * 131) % W} ${350 + ((i * 71) % 470)} q6 -5 12 0 q6 -5 12 0`} />
        ))}
      </g>

      {/* Bridges between islands */}
      {layout.islands.slice(1).map((isl, k) => {
        const prev = layout.islands[k];
        const a: P = [prev.ox + 342, prev.oy + 488];
        const b: P = [isl.ox + 48, isl.oy + 482];
        const d = `M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 26} ${b[0]} ${b[1]}`;
        return (
          <g key={k}>
            <path d={d} transform="translate(0 10)" stroke="#0b3554" strokeWidth="14" fill="none" opacity=".25" />
            <path d={d} stroke="#b07a46" strokeWidth="13" fill="none" strokeLinecap="round" />
            <path d={d} stroke="#8a5a33" strokeWidth="13" fill="none" strokeDasharray="2 5" />
            <path d={d} transform="translate(0 -6)" stroke="#6e4026" strokeWidth="1.8" fill="none" />
            <path d={d} transform="translate(0 6)" stroke="#6e4026" strokeWidth="1.8" fill="none" />
          </g>
        );
      })}

      {layout.islands.map((isl) => (
        <g key={isl.index} transform={`translate(${isl.ox} ${isl.oy})`}>
          <g transform={`translate(195 476) scale(${isl.size}) translate(-195 -476)`}>
            <IslandBase id={id} u={u} night={night} />
            {isl.index === 0 && layout.lighthouse && <Lighthouse x={302} y={444} night={night} lh={u("lh")} glow={u("glow")} />}
            {isl.pieces.map((p, i) => {
              const key = `${isl.index}-${i}`;
              return (
                <g
                  key={key}
                  transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
                  onClick={
                    onPick
                      ? (e) => {
                          e.stopPropagation();
                          onPick(key);
                        }
                      : undefined
                  }
                  className={onPick ? "cursor-pointer" : undefined}
                  opacity={picked && picked !== key ? 0.5 : 1}
                >
                  <PieceArt p={p} night={night} glow={u("glow")} />
                  {picked === key && <circle cx="0" cy="-20" r="32" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 4" />}
                </g>
              );
            })}
            {isl.index === 0 && names && <Signpost names={names} wood={u("wood")} />}
          </g>
        </g>
      ))}
      {layout.boat && last && <Boat x={last.ox + 318} y={last.oy + 626} />}

      {/* Fog that clears as you talk */}
      {layout.fog > 0.02 && (
        <g filter={`url(#${id("blur")})`} fill="#ffffff" opacity={layout.fog} pointerEvents="none">
          {layout.islands.map((isl) => (
            <g key={isl.index} transform={`translate(${isl.ox} ${isl.oy})`}>
              <ellipse cx="60" cy="430" rx="120" ry="60" />
              <ellipse cx="340" cy="510" rx="130" ry="64" />
              <ellipse cx="320" cy="390" rx="90" ry="40" />
              <ellipse cx="110" cy="560" rx="120" ry="50" />
              <ellipse cx="200" cy="370" rx="150" ry="36" />
              <ellipse cx="190" cy="610" rx="200" ry="60" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
});

function IslandBase({ id, u, night }: { id: (s: string) => string; u: (s: string) => string; night: boolean }) {
  const isl = `#${id("isl")}`;
  return (
    <g>
      <use href={isl} transform="translate(195 482) scale(1.22 1.34) translate(-195 -482)" fill="#7fe6ee" opacity={night ? 0.16 : 0.42} />
      <use href={isl} transform="translate(195 482) scale(1.13 1.21) translate(-195 -480)" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="18 10" opacity={night ? 0.4 : 0.8} />
      <use href={isl} transform="translate(0 40) translate(195 476) scale(1.08 1.06) translate(-195 -476)" fill={night ? "#cfb487" : "#f5dca8"} />
      <use href={isl} transform="translate(0 40) translate(195 476) scale(1.08 1.06) translate(-195 -476)" fill="none" stroke={night ? "#a99068" : "#ddbd82"} strokeWidth="3" />
      <use href={isl} transform="translate(0 30)" fill={u("cliff")} />
      <use href={isl} transform="translate(0 12)" fill="none" stroke="#7a4826" strokeWidth="2" opacity=".35" />
      <use href={isl} transform="translate(0 22)" fill="none" stroke="#5e3920" strokeWidth="1.5" opacity=".3" strokeDasharray="22 14" />
      <use href={isl} fill={u("grass")} />
      <use href={isl} fill="none" stroke={night ? "#9fd07f" : "#d4fbb0"} strokeWidth="3" opacity=".7" />
      <g fill={night ? "#3a6e36" : "#58a84d"} opacity=".45">
        <ellipse cx="120" cy="440" rx="16" ry="5" />
        <ellipse cx="250" cy="420" rx="12" ry="4" />
        <ellipse cx="290" cy="500" rx="18" ry="5" />
        <ellipse cx="90" cy="500" rx="12" ry="4" />
        <ellipse cx="200" cy="530" rx="14" ry="4" />
      </g>
      <path d="M70 492 C120 476 160 500 210 486 C250 476 290 486 330 474" stroke={night ? "#b39a6c" : "#e9cf9a"} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M70 492 C120 476 160 500 210 486 C250 476 290 486 330 474" stroke={night ? "#c8b085" : "#f6e3bd"} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="2 9" />
    </g>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="34" ry="10" />
      <circle cx="-12" cy="-6" r="12" />
      <circle cx="9" cy="-11" r="15" />
      <circle cx="24" cy="-4" r="9" />
    </g>
  );
}

function windowColour(night: boolean) {
  return night ? "#ffd86b" : "#a9dcf7";
}

function PieceArt({ p, night, glow }: { p: Piece; night: boolean; glow: string }) {
  const w = windowColour(night);
  switch (p.kind) {
    case "house":
      return <House p={p} night={night} glow={glow} w={w} />;
    case "office": {
      const h = p.level === 3 ? 78 : p.level === 2 ? 48 : 28;
      const floors = Math.floor((h - 4) / 9);
      return (
        <g>
          <Shadow rx={26} />
          <Box a={22} b={28} h={h} left="#d5ecf9" right="#a3cbe3" top="#eef7fd" />
          {Array.from({ length: floors }, (_, k) => (
            <g key={k}>
              <Win side="l" a={22} b={28} u0={0.08} u1={0.92} v0={k * 9 + 4} v1={k * 9 + 9} fill={night ? "#ffe08a" : "#3d6f98"} />
              <Win side="r" a={22} b={28} u0={0.06} u1={0.94} v0={k * 9 + 4} v1={k * 9 + 9} fill={night ? "#f5cf6a" : "#2c5878"} />
            </g>
          ))}
          {p.level === 3 && (
            <>
              <path d={`M2 ${-h - 6} V${-h - 22}`} stroke="#6b6f7a" strokeWidth="1.6" />
              <circle cx="2" cy={-h - 23} r="2" fill="#e5484d" />
            </>
          )}
        </g>
      );
    }
    case "stall":
      if (p.level === 1) return <Stall night={night} />;
      return (
        <g>
          <Shadow rx={30} />
          <Box a={24} b={32} h={20} left="#ffdcae" right="#f0b675" top="#e9a35f" />
          <Win side="l" a={24} b={32} u0={0.55} u1={0.8} v0={0} v1={12} fill="#7a4a2e" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Win key={k} side="r" a={24} b={32} u0={k / 6} u1={(k + 1) / 6} v0={13} v1={20} fill={k % 2 ? "#ffffff" : "#e5484d"} />
          ))}
          <Win side="r" a={24} b={32} u0={0.12} u1={0.88} v0={4} v1={11} fill={night ? "#ffd36b" : "#5e3920"} />
          <Box a={3} b={24} h={8} z={20} left="#e5484d" right="#b83236" top="#ff8a8d" />
          {p.level === 3 && (
            <>
              <Umbrella x={22} y={10} c="#ef6a3a" />
              <Umbrella x={-4} y={20} c="#2f80ed" />
            </>
          )}
        </g>
      );
    case "cafe": {
      if (p.level === 1)
        return (
          <g>
            <Shadow rx={16} />
            <Box a={14} b={16} h={16} left="#dff7ec" right="#b4e4cd" top="#7fd0aa" />
            <Win side="r" a={14} b={16} u0={0.15} u1={0.85} v0={5} v1={12} fill={night ? "#ffd36b" : "#7a4a2e"} />
            <circle cx="0" cy="-24" r="6" fill="#fff" stroke="#7a4a2e" strokeWidth="1.5" />
            <circle cx="0" cy="-24" r="3" fill="#7a4a2e" />
          </g>
        );
      return (
        <g>
          <Shadow rx={26} />
          <Box a={22} b={26} h={20} left="#fff2e2" right="#f0d4b5" top="#e2b98e" />
          {[0, 1, 2, 3, 4].map((k) => (
            <Win key={k} side="r" a={22} b={26} u0={k / 5} u1={(k + 1) / 5} v0={14} v1={20} fill={k % 2 ? "#ffffff" : "#1aa774"} />
          ))}
          <Win side="r" a={22} b={26} u0={0.15} u1={0.85} v0={3} v1={11} fill={w} />
          <Win side="l" a={22} b={26} u0={0.5} u1={0.75} v0={0} v1={11} fill="#5e3920" />
          <Umbrella x={18} y={14} c="#1aa774" />
          {p.level === 3 && (
            <>
              <Umbrella x={-8} y={22} c="#e0477e" />
              <path d="M-14 -24 Q2 -16 18 -26" stroke="#4a4458" strokeWidth="0.8" fill="none" />
              {[-10, -4, 2, 8, 14].map((x, k) => (
                <circle key={k} cx={x} cy={-21 + (k % 2)} r="1.4" fill="#ffd36b" />
              ))}
            </>
          )}
        </g>
      );
    }
    case "pitch":
      return <Pitch level={p.level} night={night} glow={glow} />;
    case "stage":
      return <Stage level={p.level} glow={glow} />;
    case "palm":
      return (
        <g>
          {p.level >= 2 && <g transform="translate(-14 -6) scale(.85)"><Palm /></g>}
          {p.level === 3 && <g transform="translate(14 -4) scale(.9)"><Palm /></g>}
          <Palm />
          {p.level === 3 && <path d="M-12 -24 Q0 -14 12 -22" stroke="#e9d3a6" strokeWidth="2.5" fill="none" />}
        </g>
      );
    case "tree":
      return (
        <g>
          {p.level === 3 && <g transform="translate(-14 -4) scale(.9)"><Tree /></g>}
          <g transform={p.level >= 2 ? "scale(1.3)" : undefined}>
            <Tree />
          </g>
          {p.level === 3 && <g transform="translate(14 8)"><Box a={4} b={14} h={4} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>}
        </g>
      );
    case "bus":
      return (
        <g>
          {p.level >= 2 && (
            <g transform="translate(-22 -12)">
              <path d="M-8 0 V-20 M8 4 V-16" stroke="#4a4458" strokeWidth="1.8" />
              <Box a={8} b={20} h={2} z={20} left="#2f80ed" right="#2364b8" top="#5aa0f5" />
            </g>
          )}
          {p.level === 3 && <g transform="translate(16 -12) scale(.9)"><Danfo /></g>}
          <Danfo />
        </g>
      );
    case "lamp":
      return (
        <g>
          {p.level >= 2 && <ellipse cx="4" cy="2" rx="22" ry="7" fill={night ? "#7a7f8c" : "#d9dbe0"} opacity=".85" />}
          {p.level === 3 && <g transform="translate(18 -2)"><Lamp night={night} glow={glow} /></g>}
          <Lamp night={night} glow={glow} />
          {p.level >= 2 && <g transform="translate(6 6)"><Box a={4} b={14} h={4} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>}
        </g>
      );
    case "flowers":
      if (p.level === 1) return <Flowers />;
      return (
        <g>
          <ellipse cx="0" cy="1" rx="24" ry="8" fill="#4fa049" />
          <g transform="translate(-10 -1)"><Flowers /></g>
          <g transform="translate(10 1)"><Flowers /></g>
          {[-22, -14, -6, 2, 10, 18].map((x, k) => (
            <path key={k} d={`M${x} ${6 + (k % 2)} v-6`} stroke="#fff" strokeWidth="1.6" />
          ))}
          {p.level === 3 && (
            <g transform="translate(0 -6)">
              <ellipse cx="0" cy="0" rx="9" ry="4" fill="#b8c0cc" />
              <ellipse cx="0" cy="-1" rx="7" ry="3" fill="#6fd0f2" />
              <path d="M0 -2 V-12 M-3 -9 Q0 -14 3 -9" stroke="#bfefff" strokeWidth="1.6" fill="none" />
            </g>
          )}
        </g>
      );
    case "rocks":
      if (p.level === 1) return <Rocks />;
      if (p.level === 2)
        return (
          <g>
            <Shadow rx={14} />
            <ellipse cx="0" cy="-4" rx="10" ry="5" fill="#9aa1ad" />
            <rect x="-10" y="-12" width="20" height="8" fill="#8d94a1" />
            <ellipse cx="0" cy="-12" rx="10" ry="5" fill="#c4cad4" />
            <ellipse cx="0" cy="-12" rx="7" ry="3" fill="#2b4d6b" />
            <path d="M-9 -12 V-28 M9 -12 V-28" stroke="#7a4a2e" strokeWidth="2" />
            <polygon points="-12,-27 0,-34 12,-27 0,-22" fill="#b4532a" />
          </g>
        );
      return (
        <g>
          <Shadow rx={14} />
          <Box a={12} b={12} h={10} left="#d3d7de" right="#a9afba" top="#e6e9ee" />
          <path d="M-12 -22 C-12 -30 -4 -30 0 -27 C4 -30 12 -30 12 -22 C12 -15 6 -13 3 -15 C1 -16 0 -18 0 -18 C0 -18 -1 -16 -3 -15 C-6 -13 -12 -15 -12 -22 Z" fill="#3a3350" />
          <ellipse cx="-6" cy="-22" rx="3" ry="2" fill="#fff" />
          <ellipse cx="6" cy="-22" rx="3" ry="2" fill="#fff" />
        </g>
      );
  }
}

function House({ p, night, glow, w }: { p: Piece; night: boolean; glow: string; w: string }) {
  const a = p.level === 3 ? 26 : 22;
  const b = p.level === 3 ? 26 : 22;
  const h = p.level === 3 ? 60 : p.level === 2 ? 34 : 18;
  const right = shade(p.wall, 0.86);
  return (
    <g>
      <Shadow rx={p.level === 3 ? 30 : 26} />
      <Box a={a} b={b} h={h} left={p.wall} right={right} top={shade(p.wall, 0.94)} />
      <Win side="l" a={a} b={b} u0={0.56} u1={0.78} v0={0} v1={10} fill="#7a4a2e" />
      {p.level === 3 ? (
        <>
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <Win side="r" a={a} b={b} u0={0.14} u1={0.38} v0={12 + k * 10} v1={18 + k * 10} fill={w} />
              <Win side="r" a={a} b={b} u0={0.6} u1={0.84} v0={12 + k * 10} v1={18 + k * 10} fill={w} />
              <Win side="l" a={a} b={b} u0={0.18} u1={0.4} v0={12 + k * 10} v1={18 + k * 10} fill={shade(w, 0.92)} />
            </g>
          ))}
          <Box a={10} b={8} h={8} z={h} left="#2b2638" right="#1c1828" top="#3a3350" />
        </>
      ) : (
        <>
          <Win side="r" a={a} b={b} u0={0.32} u1={0.66} v0={6} v1={13} fill={w} />
          {night && <circle cx="6" cy="-10" r="10" fill={glow} />}
          {p.level === 2 && (
            <>
              <Win side="r" a={a} b={b} u0={0.16} u1={0.42} v0={21} v1={28} fill={w} />
              <Win side="r" a={a} b={b} u0={0.58} u1={0.84} v0={21} v1={28} fill={w} />
              <Win side="l" a={a} b={b} u0={0.2} u1={0.45} v0={21} v1={28} fill={shade(w, 0.92)} />
            </>
          )}
          <Roof a={a} b={b} h={h} rise={p.level === 2 ? 16 : 18} color={p.roof} />
        </>
      )}
    </g>
  );
}

function Stall({ night }: { night: boolean }) {
  return (
    <g>
      <Shadow rx={26} />
      <polygon points="-20,-4 0,6 0,-6 -20,-16" fill="#b06a3b" />
      <polygon points="0,6 20,-4 20,-16 0,-6" fill="#874c28" />
      <polygon points="-20,-16 0,-6 20,-16 0,-26" fill="#d6955c" />
      <circle cx="-6" cy="-17" r="3.4" fill="#e85d2a" />
      <circle cx="2" cy="-19" r="3.4" fill="#f2b33d" />
      <circle cx="7" cy="-15" r="3" fill="#7a3d1e" />
      <path d="M-19 -16 V-40 M19 -16 V-40" stroke="#4a4458" strokeWidth="2" />
      <polygon points="-25,-38 0,-26 25,-38 0,-51" fill="#ef6a3a" />
      <polygon points="-12,-44.5 -6,-41.5 18,-41.5 12,-44.5" fill="#fff" opacity=".9" />
      <polygon points="-25,-38 0,-26 0,-23 -25,-35" fill="#d4501f" />
      <polygon points="0,-26 25,-38 25,-35 0,-23" fill="#b9431a" />
      {[[-19, -33], [-11, -29], [-3, -25], [6, -26], [14, -30], [21, -34]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill={night ? "#ffe27a" : "#fff"} />
      ))}
    </g>
  );
}

function Umbrella({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="1" rx="7" ry="3" fill="#000" opacity=".15" />
      <path d="M0 0 V-16" stroke="#4a4458" strokeWidth="1.4" />
      <ellipse cx="0" cy="-2" rx="5" ry="2.4" fill="#f5f5f5" />
      <path d="M-10 -15 Q0 -24 10 -15 Z" fill={c} />
      <path d="M-3 -15 Q0 -23 3 -15 Z" fill="#fff" opacity=".85" />
    </g>
  );
}

function Pitch({ level, night, glow }: { level: 1 | 2 | 3; night: boolean; glow: string }) {
  const a = 30;
  const b = 46;
  const { F, B, L, R } = corners(a, b);
  const midA: P = [-a / 2, a / 4];
  const midB: P = [a / 2, -a / 4];
  return (
    <g>
      <Shadow rx={32} ry={12} />
      {level >= 2 && (
        <g transform={`translate(${-b / 2 - 4} ${-b / 4 - 2})`}>
          <Box a={30} b={6} h={8} left="#e5484d" right="#b83236" top="#ff8a8d" />
        </g>
      )}
      <polygon points={pts(L, F, R, B)} fill="#3fae54" />
      <polygon points={pts([L[0] * 0.5 + F[0] * 0.5, L[1] * 0.5 + F[1] * 0.5], F, [F[0] * 0.5 + R[0] * 0.5, F[1] * 0.5 + R[1] * 0.5], [0, 0])} fill="#4cbc60" />
      <polygon points={pts(L, F, R, B)} fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d={`M${midA[0]} ${midA[1]} L${midB[0]} ${midB[1]}`} stroke="#fff" strokeWidth="1.2" />
      <ellipse cx="0" cy="0" rx="6" ry="3" fill="none" stroke="#fff" strokeWidth="1.2" />
      <path d={`M${-b / 2 - 2} ${-b / 4 - 1} v-6 h5 v6 M${b / 2 - 3} ${b / 4 - 1} v-6 h5 v6`} stroke="#fff" strokeWidth="1.4" fill="none" />
      <circle cx="3" cy="2" r="1.6" fill="#fff" />
      {level === 3 &&
        [L, R, B, F].map((c, k) => (
          <g key={k} transform={`translate(${c[0]} ${c[1]})`}>
            <path d="M0 0 V-34" stroke="#6b6f7a" strokeWidth="1.6" />
            <rect x="-4" y="-38" width="8" height="5" rx="1" fill="#f5f5f5" />
            {night && <circle cx="0" cy="-36" r="14" fill={glow} />}
          </g>
        ))}
    </g>
  );
}

function Stage({ level, glow }: { level: 1 | 2 | 3; glow: string }) {
  return (
    <g>
      <Shadow rx={30} />
      <Box a={22} b={32} h={7} left="#3a3350" right="#2a2438" top="#4f4670" />
      <g transform="translate(-18 -8)"><Box a={5} b={5} h={13} z={7} left="#1c1828" right="#14111f" top="#3a3350" /></g>
      <g transform="translate(16 2)"><Box a={5} b={5} h={13} z={7} left="#1c1828" right="#14111f" top="#3a3350" /></g>
      <path d="M2 -9 V-22" stroke="#9aa1ad" strokeWidth="1.2" />
      <circle cx="2" cy="-23" r="1.6" fill="#1c1828" />
      {level >= 2 && (
        <g>
          <path d="M-20 -14 V-44 M22 -4 V-34 M-20 -44 L22 -34" stroke="#6b6f7a" strokeWidth="2" fill="none" />
          {([["#e0477e", -12, -42], ["#8f3fd9", 0, -39], ["#ffd36b", 12, -36]] as const).map(([col, x, y], k) => (
            <g key={k}>
              <circle cx={x} cy={y} r="12" fill={glow} opacity=".55" />
              <circle cx={x} cy={y} r="2.6" fill={col} />
            </g>
          ))}
        </g>
      )}
      {level === 3 &&
        [[-10, 16], [-2, 20], [6, 18], [14, 22], [-16, 22], [0, 26], [10, 27]].map(([x, y], k) => (
          <g key={k}>
            <circle cx={x} cy={y} r="2.6" fill={["#5c3a24", "#8a5a3c", "#3b2618", "#7a4a2e"][k % 4]} />
            {k % 2 === 0 && <path d={`M${x + 2} ${y - 1} l3 -6`} stroke="#5c3a24" strokeWidth="1.4" />}
          </g>
        ))}
    </g>
  );
}

function Palm() {
  return (
    <g>
      <ellipse cx="2" cy="2" rx="16" ry="5" fill="#0b2a1a" opacity=".16" />
      <path d="M0 0 C3 -16 1 -34 8 -52" stroke="#8a5a3c" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M0 0 C3 -16 1 -34 8 -52" stroke="#5e3920" strokeWidth="6" fill="none" strokeDasharray="1.5 5" />
      <path d="M8 -52 C20 -56 30 -48 31 -36 C24 -46 16 -50 8 -52 Z" fill="#1f7a42" />
      <path d="M8 -52 C-6 -62 -22 -58 -30 -44 C-18 -52 -6 -52 8 -52 Z" fill="#2c9a55" />
      <path d="M8 -52 C24 -64 38 -58 42 -44 C30 -52 18 -54 8 -52 Z" fill="#2c9a55" />
      <path d="M8 -52 C-4 -66 -16 -70 -24 -64 C-12 -62 -2 -58 8 -52 Z" fill="#46c06e" />
      <path d="M8 -52 C0 -70 10 -80 22 -78 C14 -70 11 -62 8 -52 Z" fill="#46c06e" />
      <circle cx="5" cy="-49" r="3.6" fill="#6b4228" />
      <circle cx="10.5" cy="-48" r="3.6" fill="#7a4a2e" />
    </g>
  );
}

function Tree() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="15" ry="5" fill="#0b2a1a" opacity=".16" />
      <rect x="-2.5" y="-16" width="5" height="17" rx="1.5" fill="#7a4a2e" />
      <circle cx="-7" cy="-22" r="10" fill="#33a157" />
      <circle cx="7" cy="-22" r="10" fill="#258848" />
      <circle cx="0" cy="-31" r="11.5" fill="#4cc06c" />
      <circle cx="-4" cy="-35" r="4.5" fill="#8be39a" opacity=".85" />
    </g>
  );
}

function Danfo() {
  return (
    <g>
      <ellipse cx="-2" cy="5" rx="36" ry="9" fill="#0b2a1a" opacity=".18" />
      <polygon points="-30,-8 6,10 6,-12 -30,-30" fill="#f7c614" />
      <polygon points="6,10 22,2 22,-20 6,-12" fill="#d4a10a" />
      <polygon points="-30,-30 6,-12 22,-20 -14,-38" fill="#ffe36b" />
      <polygon points="-30,-15 6,3 6,0 -30,-18" fill="#1c1828" />
      <polygon points="-26,-21 -18,-17 -18,-25 -26,-29" fill="#2b3a55" />
      <polygon points="-15,-15.5 -7,-11.5 -7,-19.5 -15,-23.5" fill="#2b3a55" />
      <polygon points="-4,-10 4,-6 4,-14 -4,-18" fill="#2b3a55" />
      <polygon points="8,-4 20,-10 20,-18 8,-12" fill="#3a4c6e" />
      <polygon points="-12,-34 -2,-29 4,-32 -6,-37" fill="#c9a25a" />
      <ellipse cx="-21" cy="-5" rx="4" ry="5" fill="#1c1828" />
      <ellipse cx="-1" cy="5" rx="4" ry="5" fill="#1c1828" />
      <ellipse cx="17" cy="1" rx="3.4" ry="4.4" fill="#1c1828" />
    </g>
  );
}

function Lamp({ night, glow }: { night: boolean; glow: string }) {
  return (
    <g>
      <circle cx="0" cy="-34" r={night ? 22 : 12} fill={glow} />
      <rect x="-1.2" y="-32" width="2.4" height="32" fill="#2f2a3a" />
      <rect x="-4" y="-39" width="8" height="8" rx="2" fill="#ffe27a" />
      <path d="M-5.5 -39 L0 -43 L5.5 -39 Z" fill="#2f2a3a" />
    </g>
  );
}

function Flowers() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="13" ry="4.5" fill="#469a46" />
      <circle cx="-7" cy="-2" r="3" fill="#ff6fa1" />
      <circle cx="0" cy="-4" r="3" fill="#ffd25a" />
      <circle cx="7" cy="-1" r="3" fill="#fff" />
      <circle cx="-1" cy="1.5" r="2.6" fill="#b18cff" />
    </g>
  );
}

function Rocks() {
  return (
    <g>
      <polygon points="-11,1 -7,-9 2,-12 9,-4 7,2" fill="#8d94a1" />
      <polygon points="-7,-9 2,-12 9,-4 0,-5" fill="#c4cad4" />
    </g>
  );
}

function Lighthouse({ x, y, night, lh, glow }: { x: number; y: number; night: boolean; lh: string; glow: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="3" rx="19" ry="6" fill="#0b2a1a" opacity=".18" />
      <ellipse cx="0" cy="0" rx="16" ry="6" fill="#8b8f99" />
      <path d="M-11 0 L-7 -64 L7 -64 L11 0 Z" fill={lh} />
      <path d="M-10.1 -14 L10.1 -14 L9.5 -24 L-9.5 -24 Z" fill="#e5484d" />
      <path d="M-8.6 -38 L8.6 -38 L8.1 -48 L-8.1 -48 Z" fill="#e5484d" />
      <circle cx="0" cy="-70" r="26" fill={glow} />
      <rect x="-6" y="-76" width="12" height="12" rx="1" fill="#ffe27a" />
      <ellipse cx="0" cy="-64" rx="11" ry="3.5" fill="#1c1828" />
      <path d="M-8 -76 L0 -87 L8 -76 Z" fill="#1c1828" />
      <path d="M6 -71 L86 -98 L86 -48 Z" fill="#fff2b8" opacity={night ? 0.45 : 0.25} />
    </g>
  );
}

function Boat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="4" rx="26" ry="5" fill="#0b3554" opacity=".35" />
      <path d="M-24 -2 Q0 10 24 -2 L19 -7 L-19 -7 Z" fill="#a8582e" />
      <path d="M-19 -7 L19 -7" stroke="#6e3519" strokeWidth="2" />
      <path d="M0 -7 V-30" stroke="#5a3a24" strokeWidth="2" />
      <path d="M1.5 -30 L18 -10 L1.5 -10 Z" fill="#fff" />
    </g>
  );
}

function Signpost({ names, wood }: { names: [string, string]; wood: string }) {
  const text = `${names[0] || "You"} & ${names[1] || "them"}`;
  return (
    <g transform="translate(195 600)">
      <ellipse cx="0" cy="2" rx="26" ry="6" fill="#0b2a1a" opacity=".18" />
      <rect x="-3.5" y="-50" width="7" height="52" rx="2" fill="#8a5a3c" />
      <path d="M-62 -70 H56 L66 -58 L56 -46 H-62 Z" fill={wood} stroke="#7a4a2e" strokeWidth="2.5" />
      <text x="-2" y="-53" textAnchor="middle" fontFamily="Georgia, serif" fontSize={text.length > 16 ? 11 : 14} fontWeight="700" fill="#3a2210">
        {text}
      </text>
    </g>
  );
}
