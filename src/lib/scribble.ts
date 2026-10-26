/**
 * Scribbles: drawings sent as stickers. Saved as strokes (not a picture), so they stay sharp at any
 * size and can draw themselves again in the chat, the way they were drawn.
 *
 * A stroke's points are [x, y, ms since the last point, x, y, ms, …] on a 300 × 300 canvas.
 */
export type Brush = "pen" | "neon" | "rainbow" | "glitter";
export type Stroke = { b: Brush; c: string; s: number; p: number[] };
export type Drawing = { v: 1; strokes: Stroke[] };

export const SCRIBBLE_SIZE = 300;
export const SCRIBBLE_MAX_POINTS = 3500;

export const BRUSHES: { id: Brush; name: string }[] = [
  { id: "pen", name: "Pen" },
  { id: "neon", name: "Neon" },
  { id: "rainbow", name: "Rainbow" },
  { id: "glitter", name: "Glitter" },
];
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
export function drawScribble(ctx: CanvasRenderingContext2D, d: Drawing, upTo = Infinity, times = timeline(d).times, outline = true) {
  const W = ctx.canvas.width;
  const k = W / SCRIBBLE_SIZE;
  ctx.clearRect(0, 0, W, ctx.canvas.height);
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

  // The white sticker edge, with a soft shadow
  if (outline) {
    ctx.save();
    ctx.shadowColor = "rgba(28,24,40,0.28)";
    ctx.shadowBlur = 8 * k;
    ctx.shadowOffsetY = 2 * k;
    visible.forEach((pts) => path(pts, (w) => w + 10 * k, () => "#ffffff"));
    ctx.restore();
    visible.forEach((pts) => path(pts, (w) => w + 10 * k, () => "#ffffff"));
  }

  d.strokes.forEach((s, i) => {
    const pts = visible[i];
    if (!pts.length) return;
    if (s.b === "neon") {
      ctx.save();
      ctx.shadowColor = s.c;
      ctx.shadowBlur = s.s * 2.2 * k;
      path(pts, (w) => w, () => s.c);
      path(pts, (w) => w, () => s.c);
      ctx.restore();
      path(pts, (w) => w * 0.38, () => "rgba(255,255,255,0.92)");
    } else if (s.b === "rainbow") {
      const hue0 = (i * 47) % 360;
      path(pts, (w) => w, (n) => `hsl(${(hue0 + n * 6) % 360} 92% 58%)`);
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
        star(ctx, pts[n].x + ox, pts[n].y + oy, (2 + r * 3.5) * k, r > 0.5 ? "#ffffff" : "#ffe08a");
      }
    } else {
      path(pts, (w) => w, () => s.c);
    }
  });
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
