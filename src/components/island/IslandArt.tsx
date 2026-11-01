"use client";

import { forwardRef, useId } from "react";
import type { IslandLayout, Piece } from "@/lib/island";

type Sky = "day" | "sunset" | "night";

const SKIES: Record<Sky, { top: string; bottom: string; seaTop: string; seaBottom: string }> = {
  day: { top: "#5ec4f5", bottom: "#c9f0ff", seaTop: "#4dc3e0", seaBottom: "#1f74a6" },
  sunset: { top: "#3b2a6b", bottom: "#ffc27a", seaTop: "#4fa9c9", seaBottom: "#1e5f8a" },
  night: { top: "#0d1433", bottom: "#2c3566", seaTop: "#1d3d66", seaBottom: "#0b1d3a" },
};

/**
 * The island, drawn. "banner" shows just the island on the sea (for the top of a chat); "full"
 * is the whole scene with the sky. Tap a piece to see the message that made it.
 */
export const IslandArt = forwardRef<SVGSVGElement, {
  layout: IslandLayout;
  sky: Sky;
  names?: [string, string] | null;
  mode: "banner" | "full";
  picked?: number | null;
  onPick?: (i: number) => void;
}>(function IslandArt({ layout, sky, names, mode, picked, onPick }, ref) {
  const raw = useId();
  const id = (s: string) => `i${raw.replace(/[^a-zA-Z0-9]/g, "")}${s}`;
  const u = (s: string) => `url(#${id(s)})`;
  const h = (s: string) => `#${id(s)}`;
  const c = SKIES[sky];
  const night = sky === "night";
  const s = layout.size;
  const viewBox = mode === "banner" ? "22 362 346 204" : "0 0 390 844";

  return (
    <svg ref={ref} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={`Your island: ${layout.total} messages`}>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.top} /><stop offset="1" stopColor={c.bottom} /></linearGradient>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.seaTop} /><stop offset="1" stopColor={c.seaBottom} /></linearGradient>
        <linearGradient id={id("grass")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={night ? "#6fa65a" : "#a6e57f"} /><stop offset="1" stopColor={night ? "#3d7a3c" : "#5cb456"} /></linearGradient>
        <linearGradient id={id("cliff")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98b55" /><stop offset="1" stopColor="#7d4a2c" /></linearGradient>
        <linearGradient id={id("lh")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c7cfdb" /></linearGradient>
        <linearGradient id={id("wood")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9a066" /><stop offset="1" stopColor="#a86b3c" /></linearGradient>
        <radialGradient id={id("glow")}><stop offset="0" stopColor="#ffe9a8" stopOpacity=".95" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        <radialGradient id={id("sun")} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff1c2" /><stop offset=".55" stopColor="#ffcf73" /><stop offset="1" stopColor="#ffcf73" stopOpacity="0" /></radialGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        <path id={id("isl")} d="M38 468 C34 432 92 400 158 396 C206 392 248 388 292 404 C336 420 360 446 352 476 C344 508 300 540 236 548 C182 556 118 552 78 528 C50 512 40 492 38 468 Z" />
      </defs>

      {/* Sky and sea */}
      <rect width="390" height="844" fill={u("sky")} />
      {mode === "full" && sky !== "night" && <circle cx={sky === "day" ? 290 : 300} cy={sky === "day" ? 190 : 300} r="70" fill={u("sun")} />}
      {mode === "full" && night && (
        <g fill="#fff">
          {[[40, 80], [120, 140], [210, 60], [300, 110], [350, 200], [70, 230], [180, 190], [260, 250], [330, 40], [20, 300]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} opacity={0.6 + (i % 4) * 0.1} />
          ))}
          <circle cx="300" cy="150" r="18" fill="#fdf6d8" />
          <circle cx="308" cy="144" r="16" fill={c.top} />
        </g>
      )}
      {mode === "full" && !night && (
        <g fill="#fff" opacity=".85">
          <Cloud x={84} y={190} s={1.1} />
          <Cloud x={320} y={140} s={0.8} />
        </g>
      )}
      {mode === "full" &&
        Array.from({ length: layout.birds }, (_, i) => (
          <path key={i} d={`M${60 + i * 52} ${240 - (i % 2) * 24} q5 -5 10 0 q5 -5 10 0`} stroke={night ? "#c9d3f0" : "#3b2a3f"} strokeWidth="2" fill="none" />
        ))}
      <rect y="330" width="390" height="514" fill={u("sea")} />
      <path d="M250 340 h90 M270 352 h60 M50 360 h40" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity=".35" />

      {/* The island grows as you chat */}
      <g transform={`translate(195 476) scale(${s}) translate(-195 -476)`}>
        <use href={h("isl")} transform="translate(195 480) scale(1.18 1.28) translate(-195 -480)" fill="#8fe3ef" opacity={night ? 0.2 : 0.45} />
        <use href={h("isl")} transform="translate(195 480) scale(1.12 1.2) translate(-195 -478)" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="16 10" opacity=".75" />
        <use href={h("isl")} transform="translate(0 40) translate(195 476) scale(1.07 1.05) translate(-195 -476)" fill={night ? "#cdb383" : "#f2d7a0"} />
        <use href={h("isl")} transform="translate(0 30)" fill={u("cliff")} />
        <use href={h("isl")} transform="translate(0 16)" fill="none" stroke="#6e3f22" strokeWidth="2" opacity=".35" />
        <use href={h("isl")} fill={u("grass")} />
        <use href={h("isl")} fill="none" stroke="#c9f5a6" strokeWidth="3" opacity=".6" />
        <path d="M70 492 C120 476 160 500 210 486 C250 476 290 486 330 474" stroke={night ? "#b89d70" : "#e4c48c"} strokeWidth="9" fill="none" strokeLinecap="round" />

        {layout.lighthouse && <Lighthouse x={302} y={444} night={night} lh={u("lh")} glow={u("glow")} />}
        {layout.pieces.map((p, i) => (
          <g
            key={i}
            transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
            onClick={
              onPick
                ? (e) => {
                    e.stopPropagation();
                    onPick(i);
                  }
                : undefined
            }
            className={onPick ? "cursor-pointer" : undefined}
            opacity={picked != null && picked !== i ? 0.55 : 1}
          >
            <PieceArt p={p} night={night} glow={u("glow")} />
            {picked === i && <circle cx="0" cy="-20" r="30" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 4" />}
          </g>
        ))}
        {names && <Signpost names={names} wood={u("wood")} />}
      </g>
      {layout.boat && <Boat x={320} y={mode === "banner" ? 556 : 620} />}

      {/* Fog that clears as you talk */}
      {layout.fog > 0.02 && (
        <g filter={`url(#${id("blur")})`} fill="#ffffff" opacity={layout.fog} pointerEvents="none">
          <ellipse cx="60" cy="430" rx="120" ry="60" />
          <ellipse cx="340" cy="510" rx="130" ry="64" />
          <ellipse cx="320" cy="390" rx="90" ry="40" />
          <ellipse cx="110" cy="560" rx="120" ry="50" />
          <ellipse cx="200" cy="370" rx="150" ry="36" />
          <ellipse cx="190" cy="610" rx="200" ry="60" />
        </g>
      )}
    </svg>
  );
});

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="32" ry="10" />
      <circle cx="-11" cy="-6" r="11" />
      <circle cx="9" cy="-10" r="14" />
    </g>
  );
}

function PieceArt({ p, night, glow }: { p: Piece; night: boolean; glow: string }) {
  switch (p.kind) {
    case "house":
      return (
        <g>
          <ellipse cx="0" cy="3" rx="25" ry="8" fill="#000" opacity=".16" />
          <polygon points="-20,-6 0,4 0,-18 -20,-28" fill="#fff6e6" />
          <polygon points="0,4 20,-6 20,-28 0,-18" fill="#e6d1b1" />
          <polygon points="-23,-27 0,-16 0,-50" fill={p.color} />
          <polygon points="0,-16 23,-27 0,-50" fill={p.color} />
          <polygon points="0,-16 23,-27 0,-50" fill="#000" opacity=".22" />
          <polygon points="-13,-3 -7,0 -7,-12 -13,-15" fill="#7a4a2e" />
          {night && <circle cx="9.5" cy="-13.5" r="12" fill={glow} />}
          <polygon points="6,-8 13,-11.5 13,-19 6,-15.5" fill="#ffd36b" />
        </g>
      );
    case "palm":
      return (
        <g>
          <ellipse cx="2" cy="2" rx="16" ry="5" fill="#000" opacity=".16" />
          <path d="M0 0 C3 -16 1 -34 8 -52" stroke="#8a5a3c" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M0 0 C3 -16 1 -34 8 -52" stroke="#5e3920" strokeWidth="6" fill="none" strokeDasharray="1.5 5" />
          <path d="M8 -52 C20 -56 30 -48 31 -36 C24 -46 16 -50 8 -52 Z" fill="#237a44" />
          <path d="M8 -52 C-6 -62 -22 -58 -30 -44 C-18 -52 -6 -52 8 -52 Z" fill="#2e9b57" />
          <path d="M8 -52 C24 -64 38 -58 42 -44 C30 -52 18 -54 8 -52 Z" fill="#2e9b57" />
          <path d="M8 -52 C-4 -66 -16 -70 -24 -64 C-12 -62 -2 -58 8 -52 Z" fill="#45bb6c" />
          <path d="M8 -52 C0 -70 10 -80 22 -78 C14 -70 11 -62 8 -52 Z" fill="#45bb6c" />
          <circle cx="5" cy="-49" r="3.6" fill="#6b4228" />
          <circle cx="10.5" cy="-48" r="3.6" fill="#7a4a2e" />
        </g>
      );
    case "tree":
      return (
        <g>
          <ellipse cx="0" cy="2" rx="15" ry="5" fill="#000" opacity=".16" />
          <rect x="-2.5" y="-16" width="5" height="17" rx="1.5" fill="#7a4a2e" />
          <circle cx="-7" cy="-22" r="10" fill="#36a058" />
          <circle cx="7" cy="-22" r="10" fill="#28894a" />
          <circle cx="0" cy="-31" r="11.5" fill="#4fbf6c" />
          <circle cx="-4" cy="-35" r="4.5" fill="#86df96" opacity=".85" />
        </g>
      );
    case "stall":
      return (
        <g>
          <ellipse cx="0" cy="4" rx="26" ry="8" fill="#000" opacity=".16" />
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
    case "bus":
      return (
        <g>
          <ellipse cx="-2" cy="5" rx="36" ry="9" fill="#000" opacity=".18" />
          <polygon points="-30,-8 6,10 6,-12 -30,-30" fill="#f5c518" />
          <polygon points="6,10 22,2 22,-20 6,-12" fill="#d6a40c" />
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
    case "lamp":
      return (
        <g>
          <circle cx="0" cy="-34" r={night ? 22 : 14} fill={glow} />
          <rect x="-1.2" y="-32" width="2.4" height="32" fill="#2f2a3a" />
          <rect x="-4" y="-39" width="8" height="8" rx="2" fill="#ffe27a" />
          <path d="M-5.5 -39 L0 -43 L5.5 -39 Z" fill="#2f2a3a" />
        </g>
      );
    case "flowers":
      return (
        <g>
          <ellipse cx="0" cy="1" rx="13" ry="4.5" fill="#469a46" />
          <circle cx="-7" cy="-2" r="3" fill="#ff6fa1" />
          <circle cx="0" cy="-4" r="3" fill="#ffd25a" />
          <circle cx="7" cy="-1" r="3" fill="#fff" />
          <circle cx="-1" cy="1.5" r="2.6" fill="#b18cff" />
        </g>
      );
    case "rocks":
      return (
        <g>
          <polygon points="-11,1 -7,-9 2,-12 9,-4 7,2" fill="#8d94a1" />
          <polygon points="-7,-9 2,-12 9,-4 0,-5" fill="#c4cad4" />
        </g>
      );
  }
}

function Lighthouse({ x, y, night, lh, glow }: { x: number; y: number; night: boolean; lh: string; glow: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="3" rx="19" ry="6" fill="#000" opacity=".18" />
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
      <ellipse cx="0" cy="4" rx="26" ry="5" fill="#123d5c" opacity=".35" />
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
      <ellipse cx="0" cy="2" rx="26" ry="6" fill="#000" opacity=".18" />
      <rect x="-3.5" y="-50" width="7" height="52" rx="2" fill="#8a5a3c" />
      <path d="M-62 -70 H56 L66 -58 L56 -46 H-62 Z" fill={wood} stroke="#7a4a2e" strokeWidth="2.5" />
      <text x="-2" y="-53" textAnchor="middle" fontFamily="Georgia, serif" fontSize={text.length > 16 ? 11 : 14} fontWeight="700" fill="#3a2210">
        {text}
      </text>
    </g>
  );
}
