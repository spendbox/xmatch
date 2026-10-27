/**
 * Scribbles: drawings sent as stickers. Saved as strokes (not a picture), so they stay sharp at any
 * size and can draw themselves again in the chat, the way they were drawn.
 *
 * A stroke's points are [x, y, ms since the last point, x, y, ms, …] on a w × h canvas (300 × 300
 * unless the drawing says otherwise; drawing together is wide). A fill is one point: where you tapped.
 */
export type Brush =
  // Paint
  | "pencil" | "pen" | "brush" | "water" | "marker" | "spray" | "fill" | "eraser"
  // Magic
  | "neon" | "rainbow" | "glitter" | "wobble" | "fire" | "hearts" | "stars";
/** u: who drew it and id: which line (drawing together, so each person undoes their own) */
export type Stroke = { b: Brush; c: string; s: number; p: number[]; u?: string; id?: string };
export type Drawing = { v: 1; strokes: Stroke[]; w?: number; h?: number };

export const SCRIBBLE_SIZE = 300;
export const SCRIBBLE_MAX_POINTS = 3500;
/** Drawing together: a wide board, so it fills the chat */
export const TOGETHER_W = 400;
export const TOGETHER_H = 300;

export const sizeOf = (d: Pick<Drawing, "w" | "h">) => ({ w: d.w ?? SCRIBBLE_SIZE, h: d.h ?? SCRIBBLE_SIZE });

export const PAINT: { id: Brush; name: string }[] = [
  { id: "pencil", name: "Pencil" },
  { id: "pen", name: "Ink" },
  { id: "brush", name: "Brush" },
  { id: "water", name: "Watercolour" },
  { id: "marker", name: "Marker" },
  { id: "spray", name: "Spray" },
];
export const MAGIC: { id: Brush; name: string }[] = [
  { id: "neon", name: "Neon" },
  { id: "rainbow", name: "Rainbow" },
  { id: "glitter", name: "Glitter" },
  { id: "wobble", name: "Wobbly" },
  { id: "fire", name: "Fire" },
  { id: "hearts", name: "Hearts" },
  { id: "stars", name: "Stars" },
];
export const BRUSHES = [...PAINT, ...MAGIC];
export const brushName = (b: Brush) => (b === "fill" ? "Fill" : b === "eraser" ? "Eraser" : (BRUSHES.find((x) => x.id === b)?.name ?? "Brush"));

/** Brushes that keep moving once drawn (neon flickers, glitter twinkles, fire flickers…) */
export const LIVING: Brush[] = ["neon", "rainbow", "glitter", "wobble", "fire", "hearts", "stars"];
export const isLiving = (d: Drawing) => d.strokes.some((s) => LIVING.includes(s.b));

/** The paint box: soft, watercolour-friendly colours (behind the +) */
export const PALETTE = [
  "#1c1828", "#5c5670", "#a8a3b5", "#ffffff",
  "#e5484d", "#ff6b4a", "#ff9f43", "#ffb02e",
  "#ffd93d", "#c5e063", "#6bcB77", "#2fb3a0",
  "#38bdf8", "#4d7cfe", "#5b6cff", "#7a5cf0",
  "#b45cf0", "#ff7aa8", "#ff4d7e", "#c2306b",
  "#8b5a3c", "#d4a373", "#f4e1c1", "#ffe4ec",
];
export const START_COLOURS = ["#1c1828", "#ff4d7e", "#4d7cfe"];
export const MIN_SIZE = 2;
export const MAX_SIZE = 30;

export function isDrawing(d: unknown): d is Drawing {
  const x = d as Drawing | null;
  return !!x && Array.isArray(x.strokes) && x.strokes.every((s) => s && Array.isArray(s.p) && typeof s.s === "number");
}

export function pointCount(d: Drawing) {
  return d.strokes.reduce((n, s) => n + s.p.length / 3, 0);
}

/** A fill spreads out over this long when the scribble plays back */
const FILL_MS = 520;

/** How long it takes to draw itself again: real time, with long pauses cut */
export function timeline(d: Drawing) {
  let t = 0;
  const starts: number[][] = d.strokes.map((s, i) => {
    if (i > 0) t += 90;
    const out: number[] = [];
    for (let k = 0; k < s.p.length; k += 3) {
      t += Math.min(s.p[k + 2] ?? 0, 60);
      out.push(t);
    }
    if (s.b === "fill") t += FILL_MS;
    return out;
  });
  return { times: starts, total: t };
}

// A steady random, so a scribble looks the same every time it's drawn
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type Pt = { x: number; y: number; w: number };

// White sticker edges go round lines, not round washes of colour
const EDGED: Brush[] = ["pencil", "pen", "brush", "neon", "rainbow", "glitter", "wobble", "fire"];

/**
 * Draws a scribble. `upTo` is how far through its timeline to draw (Infinity: all of it).
 * outline: the white sticker edge. shadow: its soft drop shadow (costly on phones, so only for the
 * finished picture). clear: wipe first. t: the clock (ms) for living brushes; without it they're still.
 */
export function drawScribble(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  upTo = Infinity,
  times = timeline(d).times,
  { outline = true, shadow = true, clear = true, t }: { outline?: boolean; shadow?: boolean; clear?: boolean; t?: number } = {},
) {
  const alive = t !== undefined;
  const now = t ?? 0;
  const W = ctx.canvas.width;
  const k = W / sizeOf(d).w;
  if (clear) ctx.clearRect(0, 0, W, ctx.canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Each stroke's points so far, and how wide the line is at each one (faster = thinner, like ink)
  const visible = d.strokes.map((s, i) => {
    const pts: Pt[] = [];
    for (let j = 0; j < s.p.length; j += 3) {
      if (times[i][j / 3] > upTo) break;
      const x = s.p[j] * k;
      const y = s.p[j + 1] * k;
      const prev = pts[pts.length - 1];
      let w = s.s * k;
      if (prev) {
        const dist = Math.hypot(x - prev.x, y - prev.y) / k;
        const speed = dist / Math.max(4, s.p[j + 2] || 16);
        const target = s.s * k * Math.min(1.25, Math.max(0.55, 1.25 - speed * 0.35));
        w = prev.w + (target - prev.w) * 0.35;
      }
      pts.push({ x, y, w });
    }
    // Wobbly: the line "boils" like a hand-drawn cartoon, about 8 times a second
    if (s.b === "wobble") {
      const frame = alive ? Math.floor(now / 125) : 0;
      for (let n = 0; n < pts.length; n++) {
        pts[n].x += (rand(frame * 31 + n * 7 + i) - 0.5) * 2.6 * k;
        pts[n].y += (rand(frame * 17 + n * 13 + i) - 0.5) * 2.6 * k;
      }
    }
    return pts;
  });

  const path = (pts: Pt[], width: (w: number, n: number) => number, style: (n: number) => string) => {
    if (!pts.length) return;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.fillStyle = style(0);
      ctx.arc(pts[0].x, pts[0].y, width(pts[0].w, 0) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let n = 1; n < pts.length; n++) {
      const a = pts[n - 1];
      const b = pts[n];
      const m0 = n === 1 ? a : { x: (pts[n - 2].x + a.x) / 2, y: (pts[n - 2].y + a.y) / 2 };
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(m0.x, m0.y);
      ctx.quadraticCurveTo(a.x, a.y, n === pts.length - 1 ? b.x : m1.x, n === pts.length - 1 ? b.y : m1.y);
      ctx.strokeStyle = style(n);
      ctx.lineWidth = width(b.w, n);
      ctx.stroke();
    }
  };

  // One smooth line through the points at one width: cheap, and see-through colours don't build up at the joins
  const whole = (pts: { x: number; y: number }[], width: number, style: string) => {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    for (let n = 1; n < pts.length - 1; n++) ctx.quadraticCurveTo(pts[n].x, pts[n].y, (pts[n].x + pts[n + 1].x) / 2, (pts[n].y + pts[n + 1].y) / 2);
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const avg = (pts: { w: number }[]) => pts.reduce((a, p) => a + p.w, 0) / Math.max(1, pts.length);
  // The same line, moved sideways (for brush bristles and watercolour layers)
  const offset = (pts: Pt[], by: number, jitter: number, seed: number) =>
    pts.map((p, n) => {
      const a = pts[Math.max(0, n - 1)];
      const b = pts[Math.min(pts.length - 1, n + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const j = jitter ? (rand(seed + n * 0.37) - 0.5) * jitter : 0;
      return { x: p.x + nx * (by + j), y: p.y + ny * (by + j), w: p.w };
    });

  // Hearts and stars are stamped along the line: where each one goes
  const stamps = (pts: Pt[], gap: number) => {
    const out: (Pt & { n: number })[] = [];
    if (!pts.length) return out;
    out.push({ ...pts[0], n: 0 });
    let along = 0;
    for (let n = 1; n < pts.length; n++) {
      along += Math.hypot(pts[n].x - pts[n - 1].x, pts[n].y - pts[n - 1].y);
      if (along >= gap) {
        along = 0;
        out.push({ ...pts[n], n: out.length });
      }
    }
    return out;
  };

  // The white sticker edge (with a soft shadow on the finished picture)
  if (outline) {
    const lines = visible.filter((_, i) => EDGED.includes(d.strokes[i].b));
    if (shadow) {
      ctx.save();
      ctx.shadowColor = "rgba(28,24,40,0.28)";
      ctx.shadowBlur = 8 * k;
      ctx.shadowOffsetY = 2 * k;
      lines.forEach((pts) => whole(pts, avg(pts) * 1.1 + 10 * k, "#ffffff"));
      ctx.restore();
    }
    lines.forEach((pts) => path(pts, (w) => w + 10 * k, () => "#ffffff"));
  }

  d.strokes.forEach((s, i) => {
    const pts = visible[i];
    if (!pts.length) return;
    if (s.b === "fill") {
      // Watercolour fill: spreads out from where they tapped when it plays back
      const img = fillImage(d, i);
      if (!img) return;
      const p = Math.min(1, Math.max(0, (upTo - times[i][0]) / FILL_MS));
      ctx.save();
      if (p < 1) {
        const r = Math.hypot(W, ctx.canvas.height) * (1 - Math.pow(1 - p, 2));
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, W, ctx.canvas.height);
      ctx.restore();
    } else if (s.b === "eraser") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      path(pts, (w) => w * 1.4, () => "#000");
      ctx.restore();
    } else if (s.b === "pencil") {
      // Graphite: thin, slightly grainy, two light passes
      const w = Math.max(1.2 * k, s.s * 0.32 * k);
      ctx.save();
      ctx.globalAlpha = 0.8;
      whole(pts, w, s.c);
      ctx.globalAlpha = 0.35;
      whole(offset(pts, 0, w * 0.9, i * 13), w * 0.8, s.c);
      ctx.restore();
    } else if (s.b === "brush") {
      // A paintbrush: a soft body of paint, then bristle lines with their own shade and thickness
      const w = avg(pts) * 1.15;
      ctx.save();
      ctx.globalAlpha = 0.55;
      whole(pts, w * 0.8, s.c);
      const n = 7;
      for (let j = 0; j < n; j++) {
        const r = rand(i * 31 + j);
        ctx.globalAlpha = 0.55 + r * 0.4;
        whole(offset(pts, (j / (n - 1) - 0.5) * w * 0.85, w * 0.05, i * 7 + j), w * (0.12 + r * 0.12), shade(s.c, (r - 0.5) * 0.35));
      }
      ctx.restore();
    } else if (s.b === "water") {
      // Watercolour: see-through layers that pool and overlap, darker where they meet
      const w = avg(pts) * 1.7;
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      // Layers of thin wash, each wandering a little, so the colour is uneven like real paint
      for (let j = 0; j < 4; j++) {
        ctx.globalAlpha = 0.13;
        whole(offset(pts, (rand(i + j * 5) - 0.5) * w * 0.18, w * 0.08, i * 11 + j * 3), w * (0.82 + j * 0.12), s.c);
      }
      // The darker rim where the wash dries
      ctx.globalAlpha = 0.16;
      const rim = Math.max(1, w * 0.07);
      whole(offset(pts, w * 0.5, w * 0.04, i * 3), rim, shade(s.c, -0.2));
      whole(offset(pts, -w * 0.5, w * 0.04, i * 5), rim, shade(s.c, -0.2));
      ctx.restore();
    } else if (s.b === "marker") {
      // Felt-tip: flat and see-through, darker where it crosses itself
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.5;
      whole(pts, avg(pts) * 1.5, s.c);
      ctx.restore();
    } else if (s.b === "spray") {
      // Spray paint: a cloud of fine dots
      ctx.save();
      ctx.fillStyle = s.c;
      for (let n = 0; n < pts.length; n++) {
        const reach = pts[n].w * 1.7;
        for (let j = 0; j < 9; j++) {
          const a = rand(i * 1000 + n * 9 + j) * Math.PI * 2;
          const r = Math.pow(rand(i * 777 + n * 13 + j), 0.8) * reach;
          ctx.globalAlpha = 0.35 + rand(n * 3 + j) * 0.4;
          ctx.beginPath();
          ctx.arc(pts[n].x + Math.cos(a) * r, pts[n].y + Math.sin(a) * r, (0.5 + rand(n + j * 7) * 0.9) * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    } else if (s.b === "neon") {
      // The glow: wide see-through lines under the bright one (a real blur is too slow on phones).
      // Living: it hums, and now and then flickers like a real sign
      const w = avg(pts);
      const flick = alive ? (rand(Math.floor(now / 70) + i * 3) > 0.94 ? 0.35 : 0.85 + 0.15 * Math.sin(now / 160 + i)) : 1;
      whole(pts, w * 3.2, alpha(s.c, 0.14 * flick));
      whole(pts, w * 2.1, alpha(s.c, 0.26 * flick));
      path(pts, (x) => x, () => s.c);
      path(pts, (x) => x * 0.38, () => "rgba(255,255,255,0.92)");
    } else if (s.b === "rainbow") {
      const hue0 = (i * 47) % 360;
      // Living: the colours flow along the line
      const shift = alive ? now * 0.12 : 0;
      path(pts, (w) => w, (n) => `hsl(${Math.round(hue0 + n * 6 + shift) % 360}, 92%, 58%)`); // commas: older browsers need them
    } else if (s.b === "glitter") {
      path(pts, (w) => w, () => s.c);
      // Sparkles along the line
      let along = 0;
      for (let n = 1; n < pts.length; n++) {
        along += Math.hypot(pts[n].x - pts[n - 1].x, pts[n].y - pts[n - 1].y);
        if (along < 9 * k) continue;
        along = 0;
        const r = rand(i * 1000 + n);
        const ox = (rand(i * 7 + n * 3) - 0.5) * pts[n].w * 1.6;
        const oy = (rand(i * 11 + n * 5) - 0.5) * pts[n].w * 1.6;
        // Living: each sparkle twinkles at its own pace
        const tw = alive ? 0.35 + 0.65 * Math.abs(Math.sin(now / 260 + r * 9)) : 1;
        star(ctx, pts[n].x + ox, pts[n].y + oy, (2 + r * 3.5) * k * tw, r > 0.5 ? "#ffffff" : "#ffe08a");
      }
    } else if (s.b === "fire") {
      // Red outside, yellow at the heart, and little flames that lick upwards
      path(pts, (w) => w * 1.15, () => "#ff4d1a");
      path(pts, (w) => w * 0.75, () => "#ffb02e");
      path(pts, (w) => w * 0.32, () => "#fff3b0");
      let along = 0;
      for (let n = 1; n < pts.length; n++) {
        along += Math.hypot(pts[n].x - pts[n - 1].x, pts[n].y - pts[n - 1].y);
        if (along < 7 * k) continue;
        along = 0;
        const r = rand(i * 500 + n);
        const lick = alive ? 0.55 + 0.45 * Math.abs(Math.sin(now / 110 + r * 12)) : 0.8;
        flame(ctx, pts[n].x, pts[n].y - pts[n].w * 0.35, pts[n].w * (0.9 + r) * lick, r > 0.6 ? "#ffb02e" : "#ff6a1a");
      }
    } else if (s.b === "hearts" || s.b === "stars") {
      const size = avg(pts) * 1.15;
      for (const m of stamps(pts, size * 1.9)) {
        const seed = rand(i * 77 + m.n);
        const beat = alive ? 1 + 0.14 * Math.sin(now / 190 + m.n * 0.9) : 1;
        const turn = s.b === "stars" ? (seed - 0.5) * 0.6 + (alive ? Math.sin(now / 400 + m.n) * 0.25 : 0) : (seed - 0.5) * 0.35;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(turn);
        ctx.scale(beat, beat);
        if (s.b === "hearts") heart(ctx, size, s.c, outline ? 3.2 * k : 0);
        else bigStar(ctx, size, s.c, outline ? 3.2 * k : 0);
        ctx.restore();
      }
    } else {
      path(pts, (w) => w, () => s.c);
    }
  });
}

/* ——— Watercolour fill ———
   The area round the tap, up to the lines already drawn, worked out on a small grid (one cell per
   unit of the drawing) and painted like watercolour: uneven, see-through, with darker edges where
   the pigment pools. Kept once worked out, since the lines before it never change. */
const fills = new WeakMap<Stroke, { key: string; img: HTMLCanvasElement | null }>();

function fillImage(d: Drawing, i: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const s = d.strokes[i];
  // Two cells per unit, so the edges come out smooth
  const Q = 2;
  const { w: uw, h: uh } = sizeOf(d);
  const w = uw * Q;
  const h = uh * Q;
  const key = `${w}x${h}:${i}`;
  const hit = fills.get(s);
  if (hit && hit.key === key) return hit.img;

  // The lines before it, drawn plainly at one pixel per unit
  const b = document.createElement("canvas");
  b.width = w;
  b.height = h;
  const bctx = b.getContext("2d", { willReadFrequently: true });
  if (!bctx) return null;
  const before: Drawing = { v: 1, w: uw, h: uh, strokes: d.strokes.slice(0, i) };
  drawScribble(bctx, before, Infinity, timeline(before).times, { outline: false, shadow: false });
  const wall = bctx.getImageData(0, 0, w, h).data;

  const x0 = Math.max(0, Math.min(w - 1, Math.round(s.p[0] * Q)));
  const y0 = Math.max(0, Math.min(h - 1, Math.round(s.p[1] * Q)));
  const solid = (n: number) => wall[n * 4 + 3] > 40;
  const inside = new Uint8Array(w * h);
  if (!solid(y0 * w + x0)) {
    const stack = [y0 * w + x0];
    inside[y0 * w + x0] = 1;
    while (stack.length) {
      const n = stack.pop()!;
      const x = n % w;
      const y = (n - x) / w;
      const next = [x > 0 ? n - 1 : -1, x < w - 1 ? n + 1 : -1, y > 0 ? n - w : -1, y < h - 1 ? n + w : -1];
      for (const m of next) {
        if (m < 0 || inside[m] || solid(m)) continue;
        inside[m] = 1;
        stack.push(m);
      }
    }
  }

  // Tuck the colour a little under the lines, so there's no white gap
  const grown = new Uint8Array(inside);
  for (let n = 0; n < w * h; n++) {
    if (inside[n]) continue;
    const x = n % w;
    if ((x > 0 && inside[n - 1]) || (x < w - 1 && inside[n + 1]) || (n >= w && inside[n - w]) || (n < w * (h - 1) && inside[n + w])) grown[n] = 2;
  }

  const m = /^#?([0-9a-f]{6})$/i.exec(s.c);
  const rgb = m ? parseInt(m[1], 16) : 0xff7aa8;
  const [R, G, B] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(w, h);
  // Soft blotches: two sizes of random grid, blended with smooth curves (no visible squares)
  const layer = (x: number, y: number, size: number, seed: number) => {
    const gx = Math.ceil(w / size) + 2;
    const fx = x / size;
    const fy = y / size;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const sm = (t: number) => t * t * (3 - 2 * t);
    const tx = sm(fx - ix);
    const ty = sm(fy - iy);
    const v = (a: number, b: number) => rand(seed + (b * gx + a) * 1.7);
    const top = v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx;
    const bot = v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx;
    return top * (1 - ty) + bot * ty;
  };
  const noise = (x: number, y: number) => layer(x, y, 90, i * 131) * 0.65 + layer(x, y, 34, i * 977 + 5) * 0.35;
  let any = false;
  for (let n = 0; n < w * h; n++) {
    if (!grown[n]) continue;
    any = true;
    const x = n % w;
    const y = (n - x) / w;
    // Near the edge of the area the pigment pools and goes darker
    let edge = grown[n] === 2;
    if (!edge) for (const dd of [-3, 3, -3 * w, 3 * w]) if (n + dd >= 0 && n + dd < w * h && !grown[n + dd]) edge = true;
    const a = edge ? 0.74 : 0.46 + noise(x, y) * 0.22;
    img.data[n * 4] = edge ? R * 0.88 : R;
    img.data[n * 4 + 1] = edge ? G * 0.88 : G;
    img.data[n * 4 + 2] = edge ? B * 0.88 : B;
    img.data[n * 4 + 3] = Math.round(a * 255);
  }
  octx.putImageData(img, 0, 0);
  const result = any ? out : null;
  fills.set(s, { key, img: result });
  return result;
}

function shade(hex: string, by: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(by > 0 ? c + (255 - c) * by : c * (1 + by))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function alpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,122,168,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function heart(ctx: CanvasRenderingContext2D, size: number, fill: string, edge: number) {
  const r = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.6, -r * 0.1, -r * 0.75, -r * 1.25, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.75, -r * 1.25, r * 1.6, -r * 0.1, 0, r * 0.95);
  ctx.closePath();
  if (edge) {
    ctx.lineWidth = edge * 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

function bigStar(ctx: CanvasRenderingContext2D, size: number, fill: string, edge: number) {
  const R = size * 0.62;
  ctx.beginPath();
  for (let n = 0; n < 10; n++) {
    const a = (n / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = n % 2 ? R * 0.48 : R;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  if (edge) {
    ctx.lineWidth = edge * 2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x - h * 0.28, y);
  ctx.quadraticCurveTo(x - h * 0.3, y - h * 0.6, x, y - h);
  ctx.quadraticCurveTo(x + h * 0.3, y - h * 0.6, x + h * 0.28, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = fill;
  ctx.fill();
}
