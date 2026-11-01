"use client";

import { forwardRef, useId } from "react";
import { hash, type IslandLayout, type Piece } from "@/lib/island";

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

export type IslandView = { x: number; y: number; s: number };

/** Half a tile's width on screen, and how tall the cliffs are */
export const TILE = 30;
const CLIFF = 12;

/** Turn the grid a quarter at a time (rotate the view) */
function turn(gx: number, gy: number, rot: number): [number, number] {
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
/** Where a grid square sits on screen */
const proj = (rx: number, ry: number): P => [(rx - ry) * TILE, ((rx + ry) * TILE) / 2];
const diamond = (c: P, k = 1) => pts([c[0], c[1] - (TILE / 2) * k], [c[0] + TILE * k, c[1]], [c[0], c[1] + (TILE / 2) * k], [c[0] - TILE * k, c[1]]);

/** How big the island looks on screen, from its middle (for fitting it to the screen) */
export function islandExtent(layout: IslandLayout) {
  const r = layout.radius + 2;
  return { halfW: r * TILE * 1.42, halfH: r * TILE * 0.72 };
}

/**
 * The island town, drawn on the sea. `view` places and zooms it, `rot` turns it. Tap a piece to
 * see the message that made it.
 */
export const IslandArt = forwardRef<
  SVGSVGElement,
  {
    layout: IslandLayout;
    sky: Sky;
    names?: [string, string] | null;
    picked?: number | null;
    onPick?: (i: number) => void;
    rot?: number;
    view: IslandView;
    width: number;
    height: number;
    worldRef?: React.Ref<SVGGElement>;
    className?: string;
    style?: React.CSSProperties;
  }
>(function IslandArt({ layout, sky, names, picked, onPick, rot = 0, view, width, height, worldRef, className, style }, ref) {
  const raw = useId();
  const id = (s: string) => `i${raw.replace(/[^a-zA-Z0-9]/g, "")}${s}`;
  const u = (s: string) => `url(#${id(s)})`;
  const c = SKIES[sky];
  const night = sky === "night";
  const { halfW, halfH } = islandExtent(layout);

  // Everything in turned grid squares
  const land = new Set<string>();
  layout.land.forEach((k) => {
    const [gx, gy] = k.split(",").map(Number);
    const [rx, ry] = turn(gx, gy, rot);
    land.add(`${rx},${ry}`);
  });
  const roadAxis = (a: "x" | "y" | "both"): "x" | "y" | "both" => (a === "both" || rot % 2 === 0 ? a : a === "x" ? "y" : "x");
  const roadSet = new Map<string, "x" | "y" | "both">();
  layout.roads.forEach((r) => {
    const [rx, ry] = turn(r.gx, r.gy, rot);
    roadSet.set(`${rx},${ry}`, roadAxis(r.axis));
  });
  const tiles = Array.from(land).map((k) => k.split(",").map(Number) as [number, number]).sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

  // Things that stand on the island, back to front
  type Thing = { depth: number; key: string; node: React.ReactNode };
  const things: Thing[] = [];
  layout.pieces.forEach((p, i) => {
    const [rx, ry] = turn(p.gx, p.gy, rot);
    const [x, y] = proj(rx, ry);
    things.push({
      depth: rx + ry,
      key: `p${i}`,
      node: (
        <g
          transform={`translate(${x} ${y}) scale(${p.scale})`}
          onClick={
            onPick
              ? (e) => {
                  e.stopPropagation();
                  onPick(i);
                }
              : undefined
          }
          className={onPick ? "cursor-pointer" : undefined}
          opacity={picked != null && picked !== i ? 0.45 : 1}
        >
          <PieceArt p={p} night={night} glow={u("glow")} />
          {picked === i && <ellipse cx="0" cy="0" rx="34" ry="17" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 4" />}
        </g>
      ),
    });
  });
  layout.shrubs.forEach((t, i) => {
    const [rx, ry] = turn(t.gx, t.gy, rot);
    const [x, y] = proj(rx, ry);
    things.push({ depth: rx + ry, key: `s${i}`, node: <Shrub x={x} y={y} night={night} big={i % 3 === 0} /> });
  });
  layout.cars.forEach((car, i) => {
    const [rx, ry] = turn(car.gx, car.gy, rot);
    const [x, y] = proj(rx, ry);
    const ax = roadAxis(car.axis);
    // Keep to the left lane
    const off: P = ax === "x" ? [-5, 2.5] : [5, 2.5];
    things.push({
      depth: rx + ry + 0.1,
      key: `c${i}`,
      node: (
        <g transform={`translate(${x + off[0]} ${y + off[1]})`}>
          <ellipse cx="0" cy="2" rx="10" ry="4" fill="#000" opacity=".2" />
          {car.type === "bus" ? (
            <>
              <Box a={ax === "x" ? 8 : 19} b={ax === "x" ? 19 : 8} h={9} left={busColour(car.color)} right={shade(busColour(car.color), 0.82)} top={shade(busColour(car.color), 1.08)} />
              <Box a={ax === "x" ? 8.2 : 19.2} b={ax === "x" ? 19.2 : 8.2} h={1.6} z={3} left="#ffffff" right="#e6e9ee" top="#ffffff" />
              <Box a={ax === "x" ? 8.1 : 19.1} b={ax === "x" ? 19.1 : 8.1} h={2.6} z={5.4} left="#2b3a55" right="#22304a" top="#2b3a55" />
              
            </>
          ) : (
            <>
              <Box a={ax === "x" ? 7 : 15} b={ax === "x" ? 15 : 7} h={5} left={shade(car.color, 0.9)} right={shade(car.color, 0.72)} top={car.color} />
              <Box a={ax === "x" ? 6 : 8} b={ax === "x" ? 8 : 6} h={3} z={5} left="#2b3a55" right="#22304a" top={shade(car.color, 0.95)} />
            </>
          )}
          {night && <circle cx={ax === "x" ? 8 : -8} cy="0" r="6" fill={u("glow")} />}
        </g>
      ),
    });
  });
  layout.footbridges.forEach((b, i) => {
    const [rx, ry] = turn(b.gx, b.gy, rot);
    const c0 = proj(rx, ry);
    const ax = roadAxis(b.axis);
    // It crosses the road: from the plot on one side to the plot on the other
    const v: P = ax === "x" ? [-TILE / 2, TILE / 4] : [TILE / 2, TILE / 4];
    const p1: P = [c0[0] - v[0] * 1.1, c0[1] - v[1] * 1.1];
    const p2: P = [c0[0] + v[0] * 1.1, c0[1] + v[1] * 1.1];
    things.push({
      depth: rx + ry + 0.5,
      key: `b${i}`,
      node: (
        <g>
          <g transform={`translate(${p1[0]} ${p1[1]})`}><Box a={6} b={6} h={22} left="#2fb79c" right="#1f8f79" top="#5fd6bd" /></g>
          <g transform={`translate(${p2[0]} ${p2[1]})`}><Box a={6} b={6} h={22} left="#2fb79c" right="#1f8f79" top="#5fd6bd" /></g>
          <path d={`M${p1[0]} ${p1[1] - 22} L${p2[0]} ${p2[1] - 22}`} stroke="#1f8f79" strokeWidth="7" strokeLinecap="round" />
          <path d={`M${p1[0]} ${p1[1] - 24} L${p2[0]} ${p2[1] - 24}`} stroke="#5fd6bd" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${p1[0]} ${p1[1] - 30} L${p2[0]} ${p2[1] - 30}`} stroke="#e9f7f4" strokeWidth="1.2" />
        </g>
      ),
    });
  });
  if (layout.lighthouse) {
    const [rx, ry] = turn(layout.lighthouse.gx, layout.lighthouse.gy, rot);
    const [x, y] = proj(rx, ry);
    things.push({ depth: rx + ry, key: "lh", node: <g transform={`scale(.9) translate(${x / 0.9} ${y / 0.9})`}><Lighthouse x={0} y={0} night={night} lh={u("lh")} glow={u("glow")} /></g> });
  }
  if (layout.signpost && names) {
    const [rx, ry] = turn(layout.signpost.gx, layout.signpost.gy, rot);
    const [x, y] = proj(rx, ry);
    things.push({ depth: rx + ry, key: "sign", node: <g transform={`translate(${x} ${y + 6}) scale(.75)`}><Signpost names={names} wood={u("wood")} /></g> });
  }
  things.sort((a, b) => a.depth - b.depth);

  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg" className={className} style={style} role="img" aria-label={`Your island: ${layout.total} messages`}>
      <defs>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.seaTop} /><stop offset="1" stopColor={c.seaBottom} /></linearGradient>
        <linearGradient id={id("lh")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c7cfdb" /></linearGradient>
        <linearGradient id={id("wood")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dca46a" /><stop offset="1" stopColor="#a86b3c" /></linearGradient>
        <radialGradient id={id("glow")}><stop offset="0" stopColor="#ffe9a8" stopOpacity=".95" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
      </defs>

      {/* The sea fills the screen */}
      <rect width={width} height={height} fill={u("sea")} />

      <g ref={worldRef} transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
        {/* Waves around the island */}
        <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity={night ? 0.16 : 0.3}>
          {Array.from({ length: 40 }, (_, i) => {
            const a = (i * 2.399) % (Math.PI * 2);
            const r = 1.15 + ((i * 37) % 100) / 120;
            return <path key={i} d={`M${Math.cos(a) * halfW * r} ${Math.sin(a) * halfH * r} q6 -5 12 0 q6 -5 12 0`} />;
          })}
        </g>
        {/* Shallow water and foam */}
        <ellipse cx="0" cy={CLIFF + 6} rx={halfW * 1.08} ry={halfH * 1.12} fill="#7fe6ee" opacity={night ? 0.14 : 0.38} />
        <ellipse cx="0" cy={CLIFF + 6} rx={halfW * 0.98} ry={halfH * 1.0} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="20 12" opacity={night ? 0.35 : 0.75} />

        {/* Beach under the cliffs */}
        <g fill={night ? "#cdb386" : "#f4daa6"}>
          {tiles.map(([rx, ry]) => {
            const [x, y] = proj(rx, ry);
            return <polygon key={`b${rx},${ry}`} points={diamond([x, y + CLIFF + 4], 1.45)} />;
          })}
        </g>
        {/* Cliffs on the edges facing us */}
        {tiles.map(([rx, ry]) => {
          const [x, y] = proj(rx, ry);
          const R: P = [x + TILE, y];
          const B: P = [x, y + TILE / 2];
          const L: P = [x - TILE, y];
          return (
            <g key={`c${rx},${ry}`}>
              {!land.has(`${rx + 1},${ry}`) && <polygon points={pts(R, B, [B[0], B[1] + CLIFF], [R[0], R[1] + CLIFF])} fill={night ? "#6e4a2e" : "#9c6439"} />}
              {!land.has(`${rx},${ry + 1}`) && <polygon points={pts(B, L, [L[0], L[1] + CLIFF], [B[0], B[1] + CLIFF])} fill={night ? "#8a5d3a" : "#c08552"} />}
            </g>
          );
        })}
        {/* Grass and roads */}
        {tiles.map(([rx, ry]) => {
          const [x, y] = proj(rx, ry);
          const k = `${rx},${ry}`;
          const road = roadSet.get(k);
          if (!road) {
            const tone = (hash(`g${k}`) % 3) as 0 | 1 | 2;
            const g = night ? ["#5f9a4f", "#5a944b", "#64a054"][tone] : ["#8fd36b", "#86cc63", "#97da72"][tone];
            return <polygon key={`t${k}`} points={diamond([x, y])} fill={g} stroke={g} strokeWidth="0.8" />;
          }
          const asphalt = night ? "#3d414c" : "#5b606c";
          const half: P = road === "x" ? [TILE / 2, TILE / 4] : [-TILE / 2, TILE / 4];
          return (
            <g key={`t${k}`}>
              <polygon points={diamond([x, y])} fill={asphalt} stroke={asphalt} strokeWidth="0.8" />
              {road !== "both" && <path d={`M${x - half[0]} ${y - half[1]} L${x + half[0]} ${y + half[1]}`} stroke={night ? "#d8c46a" : "#f3e27a"} strokeWidth="1.4" strokeDasharray="5 4" />}
              {road === "both" && <polygon points={diamond([x, y], 0.55)} fill="none" stroke="#e9ebef" strokeWidth="1" strokeDasharray="2 2" opacity=".8" />}
            </g>
          );
        })}

        {things.map((t) => (
          <g key={t.key}>{t.node}</g>
        ))}

        {layout.boat && <g transform={`translate(${halfW * 0.78} ${halfH * 1.05})`}><Boat x={0} y={0} /></g>}
        {Array.from({ length: layout.birds }, (_, i) => (
          <path key={i} d={`M${-halfW * 0.6 + i * 46} ${-halfH * 1.1 - (i % 2) * 24} q5 -5 10 0 q5 -5 10 0`} stroke={night ? "#c9d3f0" : "#ffffff"} strokeWidth="2" fill="none" />
        ))}

        {/* Fog that clears as you talk */}
        {layout.fog > 0.02 && (
          <g filter={`url(#${id("blur")})`} fill="#ffffff" opacity={layout.fog} pointerEvents="none">
            <ellipse cx={-halfW * 0.6} cy={-halfH * 0.3} rx={halfW * 0.7} ry={halfH * 0.6} />
            <ellipse cx={halfW * 0.6} cy={halfH * 0.3} rx={halfW * 0.7} ry={halfH * 0.6} />
            <ellipse cx="0" cy={halfH * 0.9} rx={halfW} ry={halfH * 0.5} />
            <ellipse cx="0" cy={-halfH * 0.9} rx={halfW} ry={halfH * 0.5} />
          </g>
        )}
      </g>
    </svg>
  );
});

/** Little buses come in a few colours */
function busColour(seed: string) {
  return ({ "#e5484d": "#2fb79c", "#2f80ed": "#ffffff", "#f7c614": "#f7c614", "#ffffff": "#2f80ed", "#1aa774": "#ff8a3d", "#3a3350": "#e5484d" } as Record<string, string>)[seed] ?? "#2fb79c";
}

function Shrub({ x, y, night, big }: { x: number; y: number; night: boolean; big: boolean }) {
  const k = big ? 1.3 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3" fill="#0b2a1a" opacity=".15" />
      <circle cx="-4" cy="-3" r="5" fill={night ? "#2f6d3a" : "#3ea35a"} />
      <circle cx="4" cy="-3" r="5" fill={night ? "#285f33" : "#33914d"} />
      <circle cx="0" cy="-7" r="5.5" fill={night ? "#3b7f46" : "#52c070"} />
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
  const v = p.variant;
  switch (p.kind) {
    case "house":
      return <House p={p} night={night} glow={glow} w={w} />;
    case "office": {
      const h = p.level === 3 ? 78 : p.level === 2 ? 48 : 28;
      const floors = Math.floor((h - 4) / 9);
      // Blue glass, green glass or brick
      const [l, r, t, band] = [
        ["#d5ecf9", "#a3cbe3", "#eef7fd", "#3d6f98"],
        ["#d3f2e6", "#9fd6c0", "#ecfaf4", "#2f7a62"],
        ["#e9b996", "#c98f69", "#f3d2bb", "#6b3a22"],
      ][v];
      return (
        <g>
          <Shadow rx={26} />
          <Box a={22} b={26} h={h} left={l} right={r} top={t} />
          {Array.from({ length: floors }, (_, k) => (
            <g key={k}>
              <Win side="l" a={22} b={26} u0={0.08} u1={0.92} v0={k * 9 + 4} v1={k * 9 + 9} fill={night ? "#ffe08a" : band} />
              <Win side="r" a={22} b={26} u0={0.06} u1={0.94} v0={k * 9 + 4} v1={k * 9 + 9} fill={night ? "#f5cf6a" : shade(band, 0.8)} />
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
      if (p.level === 1) {
        if (v === 1) return <FruitStand />;
        if (v === 2) return <DrinksKiosk night={night} />;
        return <Stall night={night} />;
      }
      return (
        <g>
          <Shadow rx={30} />
          <Box a={24} b={28} h={20} left="#ffdcae" right="#f0b675" top="#e9a35f" />
          <Win side="l" a={24} b={28} u0={0.55} u1={0.8} v0={0} v1={12} fill="#7a4a2e" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Win key={k} side="r" a={24} b={28} u0={k / 6} u1={(k + 1) / 6} v0={13} v1={20} fill={k % 2 ? "#ffffff" : ["#e5484d", "#2f80ed", "#1aa774"][v]} />
          ))}
          <Win side="r" a={24} b={28} u0={0.12} u1={0.88} v0={4} v1={11} fill={night ? "#ffd36b" : "#5e3920"} />
          <Box a={3} b={22} h={8} z={20} left="#e5484d" right="#b83236" top="#ff8a8d" />
          {p.level === 3 && (
            <>
              <Umbrella x={18} y={10} c="#ef6a3a" />
              <Umbrella x={-4} y={16} c="#2f80ed" />
            </>
          )}
        </g>
      );
    case "cafe": {
      if (p.level === 1) {
        if (v === 1) return <IceCreamCart />;
        const [l, r, t] = v === 2 ? ["#ffd9b8", "#f5b685", "#ff9a52"] : ["#dff7ec", "#b4e4cd", "#7fd0aa"];
        return (
          <g>
            <Shadow rx={16} />
            <Box a={14} b={16} h={16} left={l} right={r} top={t} />
            <Win side="r" a={14} b={16} u0={0.15} u1={0.85} v0={5} v1={12} fill={night ? "#ffd36b" : "#7a4a2e"} />
            <circle cx="0" cy="-24" r="6" fill="#fff" stroke="#7a4a2e" strokeWidth="1.5" />
            <circle cx="0" cy="-24" r="3" fill={v === 2 ? "#ff9a52" : "#7a4a2e"} />
          </g>
        );
      }
      const stripe = ["#1aa774", "#e0477e", "#ff9a52"][v];
      return (
        <g>
          <Shadow rx={26} />
          <Box a={22} b={26} h={20} left="#fff2e2" right="#f0d4b5" top="#e2b98e" />
          {[0, 1, 2, 3, 4].map((k) => (
            <Win key={k} side="r" a={22} b={26} u0={k / 5} u1={(k + 1) / 5} v0={14} v1={20} fill={k % 2 ? "#ffffff" : stripe} />
          ))}
          <Win side="r" a={22} b={26} u0={0.15} u1={0.85} v0={3} v1={11} fill={w} />
          <Win side="l" a={22} b={26} u0={0.5} u1={0.75} v0={0} v1={11} fill="#5e3920" />
          <Umbrella x={16} y={12} c={stripe} />
          {p.level === 3 && (
            <>
              <Umbrella x={-8} y={18} c="#2f80ed" />
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
      return v === 1 ? <Court level={p.level} night={night} glow={glow} /> : <Pitch level={p.level} night={night} glow={glow} />;
    case "stage":
      return <Stage level={p.level} glow={glow} variant={v} />;
    case "palm":
      return (
        <g transform={v === 1 ? "scale(-1 1)" : undefined}>
          {p.level >= 2 && <g transform="translate(-14 -6) scale(.85)"><Palm /></g>}
          {p.level === 3 && <g transform="translate(14 -4) scale(.9)"><Palm /></g>}
          <Palm />
          {p.level === 3 && <path d="M-12 -24 Q0 -14 12 -22" stroke="#e9d3a6" strokeWidth="2.5" fill="none" />}
        </g>
      );
    case "tree": {
      const T = v === 1 ? Pine : v === 2 ? FruitTree : Tree;
      return (
        <g>
          {p.level === 3 && <g transform="translate(-14 -4) scale(.9)"><T /></g>}
          <g transform={p.level >= 2 ? "scale(1.25)" : undefined}>
            <T />
          </g>
          {p.level === 3 && <g transform="translate(14 8)"><Box a={4} b={14} h={4} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>}
        </g>
      );
    }
    case "bus":
      return <Transit level={p.level} night={night} glow={glow} />;
    case "lamp":
      return (
        <g>
          {p.level >= 2 && <ellipse cx="4" cy="2" rx="22" ry="7" fill={night ? "#7a7f8c" : "#d9dbe0"} opacity=".85" />}
          {p.level === 3 && <g transform="translate(18 -2)"><Lamp night={night} glow={glow} tall={v === 1} /></g>}
          <Lamp night={night} glow={glow} tall={v === 1} />
          {p.level >= 2 && <g transform="translate(6 6)"><Box a={4} b={14} h={4} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>}
        </g>
      );
    case "flowers": {
      const palette = [["#ff6fa1", "#ffd25a", "#fff", "#b18cff"], ["#ff8a3d", "#ffe066", "#ff5f6d", "#fff"], ["#9b7bff", "#6fc2ff", "#fff", "#ff8fc4"]][v];
      if (p.level === 1) return <Flowers c={palette} />;
      return (
        <g>
          <ellipse cx="0" cy="1" rx="24" ry="8" fill="#4fa049" />
          <g transform="translate(-10 -1)"><Flowers c={palette} /></g>
          <g transform="translate(10 1)"><Flowers c={palette} /></g>
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
    }
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
    case "gym": {
      const h = p.level === 3 ? 34 : p.level === 2 ? 26 : 20;
      const [l, r] = [["#d9dde6", "#aeb5c3"], ["#ffd7d7", "#f0a9a9"], ["#d7e9ff", "#a7c4ec"]][v];
      return (
        <g>
          <Shadow rx={28} />
          <Box a={24} b={28} h={h} left={l} right={r} top={shade(l, 0.92)} />
          <Win side="r" a={24} b={28} u0={0.08} u1={0.92} v0={5} v1={h - 6} fill={night ? "#ffe08a" : "#3a4c6e"} />
          <Win side="l" a={24} b={28} u0={0.55} u1={0.8} v0={0} v1={12} fill="#2b2638" />
          {/* A dumbbell sign on the roof */}
          <g transform={`translate(2 ${-h - 12})`}>
            <rect x="-9" y="-1.2" width="18" height="2.4" fill="#1c1828" />
            <rect x="-12" y="-5" width="4" height="10" rx="1" fill="#e5484d" />
            <rect x="8" y="-5" width="4" height="10" rx="1" fill="#e5484d" />
          </g>
          {p.level === 3 && <path d="M-26 10 Q0 22 26 10" stroke="#e5484d" strokeWidth="3" fill="none" opacity=".8" />}
        </g>
      );
    }
    case "school": {
      const h = p.level === 1 ? 18 : 30;
      return (
        <g>
          <Shadow rx={30} />
          {p.level === 3 && <g transform="translate(-16 -8)"><Box a={14} b={22} h={22} left="#fff3d6" right="#ecd6a8" top="#f7e7c3" /></g>}
          <Box a={22} b={28} h={h} left="#fff3d6" right="#ecd6a8" top="#f7e7c3" />
          {[0, 1, 2, 3].map((k) => (
            <Win key={k} side="r" a={22} b={28} u0={0.08 + k * 0.23} u1={0.24 + k * 0.23} v0={5} v1={11} fill={w} />
          ))}
          {p.level >= 2 &&
            [0, 1, 2, 3].map((k) => <Win key={`u${k}`} side="r" a={22} b={28} u0={0.08 + k * 0.23} u1={0.24 + k * 0.23} v0={18} v1={24} fill={w} />)}
          <Win side="l" a={22} b={28} u0={0.5} u1={0.78} v0={0} v1={11} fill="#7a4a2e" />
          <Gable a={22} b={28} h={h} rise={10} color={["#c0392b", "#2f80ed", "#1aa774"][v]} wall="#ecd6a8" />
          {/* A school pennant */}
          <g transform="translate(-20 -6)">
            <path d="M0 0 V-34" stroke="#6b6f7a" strokeWidth="1.4" />
            <path d="M0.5 -34 L13 -30.5 L0.5 -27 Z" fill={["#e5484d", "#f7c614", "#6d4ff0"][v]} />
          </g>
        </g>
      );
    }
    case "clinic": {
      const h = p.level === 3 ? 48 : p.level === 2 ? 32 : 20;
      return (
        <g>
          <Shadow rx={28} />
          <Box a={24} b={26} h={h} left="#ffffff" right="#dfe5ec" top="#f4f6f9" />
          {Array.from({ length: Math.floor((h - 6) / 10) }, (_, k) => (
            <Win key={k} side="r" a={24} b={26} u0={0.1} u1={0.9} v0={5 + k * 10} v1={10 + k * 10} fill={night ? "#ffe08a" : "#8ec9f2"} />
          ))}
          <Win side="l" a={24} b={26} u0={0.5} u1={0.8} v0={0} v1={11} fill="#2f80ed" />
          {/* Red cross */}
          <g transform={`translate(-12 ${-h + 4})`}>
            <rect x="-2" y="-6" width="4" height="12" fill="#e5484d" />
            <rect x="-6" y="-2" width="12" height="4" fill="#e5484d" />
          </g>
          {p.level === 3 && (
            <g transform={`translate(0 ${-h})`}>
              <ellipse cx="0" cy="0" rx="9" ry="4.5" fill="none" stroke="#f7c614" strokeWidth="1.4" />
              <text x="0" y="2" textAnchor="middle" fontSize="6" fontWeight="800" fill="#f7c614">H</text>
            </g>
          )}
        </g>
      );
    }
    case "market":
      if (p.level === 1)
        return (
          <g>
            <Shadow rx={28} />
            <g transform="translate(-10 -4)"><Umbrella x={0} y={0} c={["#ef6a3a", "#2f80ed", "#1aa774"][v]} /></g>
            <g transform="translate(10 2)"><Umbrella x={0} y={0} c={["#f7c614", "#e0477e", "#6d4ff0"][v]} /></g>
            <g transform="translate(-2 10)"><Box a={8} b={12} h={5} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>
            <circle cx="-4" cy="4" r="1.8" fill="#e5484d" />
            <circle cx="0" cy="5" r="1.8" fill="#f7c614" />
            <circle cx="3" cy="4" r="1.8" fill="#1aa774" />
          </g>
        );
      return (
        <g>
          <Shadow rx={30} />
          <Box a={26} b={28} h={p.level === 3 ? 30 : 18} left="#f2f4f7" right="#cfd5de" top="#e6e9ee" />
          <Win side="r" a={26} b={28} u0={0.06} u1={0.94} v0={3} v1={p.level === 3 ? 24 : 12} fill={night ? "#ffe08a" : "#9fd3f2"} />
          <Box a={3} b={24} h={6} z={p.level === 3 ? 30 : 18} left={["#e5484d", "#2f80ed", "#1aa774"][v]} right={shade(["#e5484d", "#2f80ed", "#1aa774"][v], 0.8)} top="#fff" />
          {/* Trolleys out front */}
          <path d="M-14 12 l6 3 M-12 10 l6 3" stroke="#9aa1ad" strokeWidth="1.4" />
        </g>
      );
    case "cinema": {
      const h = p.level === 3 ? 34 : p.level === 2 ? 26 : 20;
      return (
        <g>
          <Shadow rx={28} />
          <Box a={24} b={28} h={h} left="#5b3fd9" right="#4730b3" top="#6d55e6" />
          <Win side="r" a={24} b={28} u0={0.1} u1={0.9} v0={h - 9} v1={h - 3} fill="#ffd36b" />
          {[0.12, 0.42, 0.72].map((u0, k) => (
            <Win key={k} side="r" a={24} b={28} u0={u0} u1={u0 + 0.18} v0={4} v1={13} fill={["#e0477e", "#ffb02e", "#2fb79c"][k]} />
          ))}
          <Win side="l" a={24} b={28} u0={0.5} u1={0.8} v0={0} v1={11} fill="#1c1828" />
          {p.level === 3 && (
            <g opacity={night ? 0.5 : 0.25}>
              <path d={`M-6 ${-h} L-30 ${-h - 60} L-18 ${-h - 64} Z`} fill="#fff7c2" />
              <path d={`M8 ${-h} L30 ${-h - 62} L18 ${-h - 64} Z`} fill="#fff7c2" />
            </g>
          )}
        </g>
      );
    }
    case "pool":
      return <Pool level={p.level} />;
  }
}

/** A roof with a ridge (two slopes) */
function Gable({ a, b, h, rise, color, wall }: { a: number; b: number; h: number; rise: number; color: string; wall: string }) {
  const { F, B, L, R } = corners(a + 4, b + 4);
  const top = (p: P): P => lift(p, h);
  const m1: P = lift([(L[0] + B[0]) / 2, (L[1] + B[1]) / 2], h + rise);
  const m2: P = lift([(F[0] + R[0]) / 2, (F[1] + R[1]) / 2], h + rise);
  return (
    <g>
      <polygon points={pts(top(L), top(F), m2, m1)} fill={color} />
      <polygon points={pts(top(F), top(R), m2)} fill={shade(wall, 0.92)} />
      <polygon points={pts(top(B), top(R), m2, m1)} fill={shade(color, 0.72)} />
      <path d={`M${m1[0]} ${m1[1]} L${m2[0]} ${m2[1]}`} stroke={shade(color, 0.6)} strokeWidth="1.2" />
    </g>
  );
}

function FruitStand() {
  return (
    <g>
      <Shadow rx={22} />
      <Box a={14} b={22} h={8} left="#b97a45" right="#8a5532" top="#d39a62" />
      {[[-8, -10, "#e5484d"], [-2, -8, "#ff9a3d"], [4, -6, "#1aa774"], [-4, -12, "#f7c614"], [2, -10, "#e5484d"]].map(([x, y, c], k) => (
        <circle key={k} cx={x as number} cy={y as number} r="2.6" fill={c as string} />
      ))}
      <Umbrella x={12} y={2} c="#1aa774" />
    </g>
  );
}

function DrinksKiosk({ night }: { night: boolean }) {
  return (
    <g>
      <Shadow rx={18} />
      <Box a={14} b={16} h={18} left="#d7ecff" right="#a8cdf2" top="#2f80ed" />
      <Win side="r" a={14} b={16} u0={0.15} u1={0.85} v0={6} v1={13} fill={night ? "#ffd36b" : "#1c3d66"} />
      <g transform="translate(14 6)"><Box a={6} b={6} h={8} left="#ffffff" right="#dfe5ec" top="#e5484d" /></g>
    </g>
  );
}

function IceCreamCart() {
  return (
    <g>
      <Shadow rx={16} />
      <Box a={10} b={16} h={10} z={2} left="#ffd0e4" right="#f5a6c8" top="#fff" />
      <circle cx="-8" cy="3" r="2.6" fill="#3a3350" />
      <circle cx="6" cy="6" r="2.6" fill="#3a3350" />
      <path d="M0 -12 V-26" stroke="#4a4458" strokeWidth="1.4" />
      <path d="M-11 -25 Q0 -34 11 -25 Z" fill="#e0477e" />
      <path d="M-4 -25 Q0 -33 4 -25 Z" fill="#fff" />
    </g>
  );
}

function Pine() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="12" ry="4" fill="#0b2a1a" opacity=".16" />
      <rect x="-2" y="-8" width="4" height="9" fill="#7a4a2e" />
      <polygon points="-12,-8 12,-8 0,-24" fill="#1f7a42" />
      <polygon points="-10,-18 10,-18 0,-32" fill="#2c9a55" />
      <polygon points="-7,-27 7,-27 0,-39" fill="#46c06e" />
    </g>
  );
}

function FruitTree() {
  return (
    <g>
      <Tree />
      <circle cx="-6" cy="-24" r="2" fill="#ff9a3d" />
      <circle cx="5" cy="-28" r="2" fill="#ff9a3d" />
      <circle cx="1" cy="-20" r="2" fill="#ff9a3d" />
      <circle cx="-2" cy="-33" r="2" fill="#ff9a3d" />
    </g>
  );
}

/** Getting around: a bus stop, then a filling station, then a bus terminal */
function Transit({ level, night, glow }: { level: 1 | 2 | 3; night: boolean; glow: string }) {
  if (level === 1)
    return (
      <g>
        <Shadow rx={20} />
        <path d="M-12 2 V-18 M8 8 V-12 M-12 -18 L8 -12" stroke="#4a4458" strokeWidth="1.6" fill="none" />
        <Box a={10} b={22} h={2} z={18} left="#2f80ed" right="#2364b8" top="#5aa0f5" />
        <g transform="translate(-2 4)"><Box a={4} b={16} h={4} left="#a86b3c" right="#7a4a2e" top="#c98b55" /></g>
        <path d="M16 6 V-20" stroke="#6b6f7a" strokeWidth="1.4" />
        <rect x="11" y="-26" width="10" height="7" rx="1.5" fill="#2f80ed" />
        <text x="16" y="-20.8" textAnchor="middle" fontSize="4.5" fontWeight="800" fill="#fff">BUS</text>
      </g>
    );
  if (level === 2)
    return (
      <g>
        <Shadow rx={28} />
        <g transform="translate(-12 -4)"><Box a={10} b={12} h={14} left="#fff" right="#dfe5ec" top="#e5484d" /></g>
        {[[-6, 6], [10, 10], [4, -2], [20, 2]].map(([x, y], k) => (
          <path key={k} d={`M${x} ${y} V${y - 20}`} stroke="#9aa1ad" strokeWidth="1.6" />
        ))}
        <g transform="translate(7 4)"><Box a={18} b={24} h={3} z={20} left="#e5484d" right="#b83236" top="#ff6b6f" /></g>
        <g transform="translate(5 6)"><Box a={4} b={4} h={8} left="#f7c614" right="#d4a10a" top="#ffe36b" /></g>
        <g transform="translate(13 2)"><Box a={4} b={4} h={8} left="#f7c614" right="#d4a10a" top="#ffe36b" /></g>
        {night && <circle cx="7" cy="-16" r="16" fill={glow} />}
      </g>
    );
  return (
    <g>
      <Shadow rx={30} />
      <Box a={14} b={28} h={16} left="#e8edf3" right="#c6cfdb" top="#f4f6f9" />
      <Win side="r" a={14} b={28} u0={0.06} u1={0.94} v0={4} v1={11} fill={night ? "#ffe08a" : "#9fd3f2"} />
      <g transform="translate(8 8)"><Box a={10} b={30} h={2} z={14} left="#2f80ed" right="#2364b8" top="#5aa0f5" /></g>
      {[[-6, 18], [8, 14], [22, 10]].map(([x, y], k) => (
        <path key={k} d={`M${x} ${y} V${y - 14}`} stroke="#4a4458" strokeWidth="1.4" />
      ))}
    </g>
  );
}

function Pool({ level }: { level: 1 | 2 | 3 }) {
  const a = 22;
  const b = 26;
  const { F, B, L, R } = corners(a, b);
  const { F: f, B: bb, L: l, R: r } = corners(a - 6, b - 6);
  return (
    <g>
      <polygon points={pts(L, F, R, B)} fill="#e9edf2" />
      <polygon points={pts(l, f, r, bb)} fill="#3cc4e6" />
      <polygon points={pts([l[0], l[1]], [f[0], f[1]], [(f[0] + r[0]) / 2, (f[1] + r[1]) / 2], [(l[0] + bb[0]) / 2, (l[1] + bb[1]) / 2])} fill="#6fdcf5" opacity=".6" />
      <path d={`M${r[0] - 4} ${r[1] - 1} v-5 M${r[0] - 1} ${r[1]} v-5`} stroke="#9aa1ad" strokeWidth="1" />
      {level >= 2 && (
        <>
          <g transform="translate(-16 2)"><Box a={4} b={9} h={2} left="#ffffff" right="#dfe5ec" top="#ff9a3d" /></g>
          <g transform="translate(-10 6)"><Box a={4} b={9} h={2} left="#ffffff" right="#dfe5ec" top="#e0477e" /></g>
          <Umbrella x={16} y={-2} c="#f7c614" />
        </>
      )}
      {level === 3 && <path d="M-4 -16 C-16 -16 -16 -4 -6 -4 C2 -4 2 6 -8 8" stroke="#ff9a3d" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
    </g>
  );
}

function Court({ level, night, glow }: { level: 1 | 2 | 3; night: boolean; glow: string }) {
  const { F, B, L, R } = corners(24, 30);
  return (
    <g>
      <Shadow rx={26} ry={10} />
      <polygon points={pts(L, F, R, B)} fill="#d9733f" />
      <polygon points={pts(L, F, R, B)} fill="none" stroke="#fff" strokeWidth="1.3" />
      <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="none" stroke="#fff" strokeWidth="1.1" />
      {[L, R].map((c, k) => (
        <g key={k} transform={`translate(${c[0] * 0.8} ${c[1] * 0.8})`}>
          <path d="M0 0 V-16" stroke="#4a4458" strokeWidth="1.4" />
          <rect x="-4" y="-20" width="8" height="5" fill="#fff" stroke="#4a4458" strokeWidth=".8" />
          <circle cx="0" cy="-14" r="1.6" fill="none" stroke="#e5484d" strokeWidth="1" />
        </g>
      ))}
      {level >= 2 && <g transform="translate(-16 -10)"><Box a={24} b={5} h={6} left="#2f80ed" right="#2364b8" top="#5aa0f5" /></g>}
      {level === 3 && night &&
        [B, F].map((c, k) => <circle key={k} cx={c[0]} cy={c[1] - 26} r="14" fill={glow} />)}
    </g>
  );
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
          {p.variant === 1 ? (
            <Gable a={a} b={b} h={h} rise={12} color={p.roof} wall={p.wall} />
          ) : p.variant === 2 ? (
            <>
              <Box a={a + 2} b={b + 2} h={3} z={h} left={shade(p.wall, 0.8)} right={shade(p.wall, 0.7)} top={shade(p.wall, 0.9)} />
              <circle cx="6" cy={-h - 8} r="4" fill="#3ea35a" />
              <circle cx="-6" cy={-h - 6} r="3" fill="#52c070" />
            </>
          ) : (
            <Roof a={a} b={b} h={h} rise={p.level === 2 ? 16 : 18} color={p.roof} />
          )}
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

function Stage({ level, glow, variant = 0 }: { level: 1 | 2 | 3; glow: string; variant?: number }) {
  return (
    <g>
      <Shadow rx={30} />
      <Box a={22} b={28} h={7} left={["#3a3350", "#6b2a3a", "#1f4d6b"][variant]} right={["#2a2438", "#4f1e2b", "#16384f"][variant]} top={["#4f4670", "#8a3a4e", "#2a6a91"][variant]} />
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

function Lamp({ night, glow, tall }: { night: boolean; glow: string; tall?: boolean }) {
  if (tall)
    return (
      <g>
        <circle cx="6" cy="-44" r={night ? 22 : 12} fill={glow} />
        <path d="M0 0 V-44 Q0 -48 6 -46" stroke="#4a4458" strokeWidth="2.2" fill="none" />
        <ellipse cx="7" cy="-45" rx="4" ry="1.8" fill="#ffe27a" />
      </g>
    );
  return (
    <g>
      <circle cx="0" cy="-34" r={night ? 22 : 12} fill={glow} />
      <rect x="-1.2" y="-32" width="2.4" height="32" fill="#2f2a3a" />
      <rect x="-4" y="-39" width="8" height="8" rx="2" fill="#ffe27a" />
      <path d="M-5.5 -39 L0 -43 L5.5 -39 Z" fill="#2f2a3a" />
    </g>
  );
}

function Flowers({ c = ["#ff6fa1", "#ffd25a", "#fff", "#b18cff"] }: { c?: string[] }) {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="13" ry="4.5" fill="#469a46" />
      <circle cx="-7" cy="-2" r="3" fill={c[0]} />
      <circle cx="0" cy="-4" r="3" fill={c[1]} />
      <circle cx="7" cy="-1" r="3" fill={c[2]} />
      <circle cx="-1" cy="1.5" r="2.6" fill={c[3]} />
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
    <g>
      <ellipse cx="0" cy="2" rx="26" ry="6" fill="#0b2a1a" opacity=".18" />
      <rect x="-3.5" y="-50" width="7" height="52" rx="2" fill="#8a5a3c" />
      <path d="M-62 -70 H56 L66 -58 L56 -46 H-62 Z" fill={wood} stroke="#7a4a2e" strokeWidth="2.5" />
      <text x="-2" y="-53" textAnchor="middle" fontFamily="Georgia, serif" fontSize={text.length > 16 ? 11 : 14} fontWeight="700" fill="#3a2210">
        {text}
      </text>
    </g>
  );
}
