/**
 * Scribbles: drawings sent as stickers. Saved as strokes (not a picture), so they stay sharp at any
 * size and can draw themselves again in the chat, the way they were drawn.
 *
 * A stroke's points are [x, y, ms since the last point, x, y, ms, …] on a 300 × 300 canvas.
 */
export type Brush = "pen" | "neon" | "rainbow" | "glitter" | "wobble" | "fire" | "hearts" | "stars";
export type Stroke = { b: Brush; c: string; s: number; p: number[] };
export type Drawing = { v: 1; strokes: Stroke[] };

export const SCRIBBLE_SIZE = 300;
export const SCRIBBLE_MAX_POINTS = 3500;

export const BRUSHES: { id: Brush; name: string }[] = [
  { id: "pen", name: "Pen" },
  { id: "neon", name: "Neon" },
  { id: "rainbow", name: "Rainbow" },
  { id: "glitter", name: "Glitter" },
  { id: "wobble", name: "Wobbly" },
  { id: "fire", name: "Fire" },
  { id: "hearts", name: "Hearts" },
  { id: "stars", name: "Stars" },
];

/** Brushes that keep moving once drawn (neon flickers, glitter twinkles, fire flickers…) */
export const LIVING: Brush[] = ["neon", "rainbow", "glitter", "wobble", "fire", "hearts", "stars"];
export const isLiving = (d: Drawing) => d.strokes.some((s) => LIVING.includes(s.b));
export const INKS = ["#1c1828", "#ffffff", "#e5484d", "#ff7aa8", "#ffb02e", "#2fb3a0", "#5b6cff", "#7a5cf0"];
export const WIDTHS = [5, 9, 15];

export function isDrawing(d: unknown): d is Drawing {
  const x = d as Drawing | null;
  return !!x && Array.isArray(x.strokes) && x.strokes.every((s) => s && Array.isArray(s.p) && typeof s.s === "number");
}

export function pointCount(d: Drawing) {
  return d.strokes.reduce((n, s) => n + s.p.length / 3, 0);
}

/** How long it takes to draw itself again: real time, with long pauses cut, squeezed into 0.8–2.8 s */
export function timeline(d: Drawing) {
  let t = 0;
  const starts: number[][] = d.strokes.map((s, i) => {
    if (i > 0) t += 90;
    const out: number[] = [];
    for (let k = 0; k < s.p.length; k += 3) {
      t += Math.min(s.p[k + 2] ?? 0, 60);
      out.push(t);
    }
    return out;
  });
  return { times: starts, total: t };
}

// A steady random for glitter, so a scribble sparkles the same way every time
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Draws a scribble. `upTo` is how far through its timeline to draw (Infinity: all of it).
 * Sticker look: a white edge and a soft shadow round every line.
 */
export function drawScribble(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  upTo = Infinity,
  times = timeline(d).times,
  /** shadow: the soft drop shadow (costly on phones, so only for the finished picture). clear: wipe first.
      t: the clock (ms) for living brushes; without it they're drawn still. */
  { outline = true, shadow = true, clear = true, t }: { outline?: boolean; shadow?: boolean; clear?: boolean; t?: number } = {},
) {
  const alive = t !== undefined;
  const now = t ?? 0;
  const W = ctx.canvas.width;
  const k = W / SCRIBBLE_SIZE;
  if (clear) ctx.clearRect(0, 0, W, ctx.canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Each stroke's points so far, and how wide the line is at each one (faster = thinner, like ink)
  const visible = d.strokes.map((s, i) => {
    const pts: { x: number; y: number; w: number }[] = [];
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

  const path = (pts: { x: number; y: number; w: number }[], width: (w: number, n: number) => number, style: (n: number) => string) => {
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
  const whole = (pts: { x: number; y: number; w: number }[], width: number, style: string) => {
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

  // Hearts and stars are stamped along the line: where each one goes
  const stamps = (pts: { x: number; y: number; w: number }[], gap: number) => {
    const out: { x: number; y: number; w: number; n: number }[] = [];
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
  const stamped = (b: Brush) => b === "hearts" || b === "stars";

  // The white sticker edge (with a soft shadow on the finished picture). Stamps get their own edge.
  if (outline) {
    const lines = visible.filter((_, i) => !stamped(d.strokes[i].b));
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
    if (s.b === "neon") {
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
