/**
 * Where a mask sits on a face. Full masks use the spot found for the whole face. Party masks
 * (eyes and nose only) are placed from the eyes, brows and nose instead: the eye holes go on the
 * eyes, tilted with them, and the mask grows until it covers the brows, eyes and nose.
 */
import { isHalfMask, maskShape } from "./masks";
import type { MaskSpot } from "./types";

// In the mask drawing: the face oval's centre (what a spot points at) and the eye holes
const OVAL_CY = 112;
const EYE_Y = 102;
const EYE_GAP = 44;

// Face points (68-point layout) the mask must cover: brows 17–26, the nose bridge and tip 27–30 and 33,
// and the eyes 36–47 (not the sides of the nostrils, so the mask doesn't balloon to reach them)
const COVER = [...Array.from({ length: 14 }, (_, i) => 17 + i), 33, ...Array.from({ length: 12 }, (_, i) => 36 + i)];
/** At most this much bigger than the eyes say, so it never ends up far too big for the face */
const MAX_GROW = 1.1;

let ctx: CanvasRenderingContext2D | null = null;
const shapes = new Map<string, Path2D>();
function inShape(id: string, x: number, y: number) {
  ctx ??= document.createElement("canvas").getContext("2d");
  let p = shapes.get(id);
  if (!p) {
    p = new Path2D(maskShape(id));
    shapes.set(id, p);
  }
  return ctx ? ctx.isPointInPath(p, x, y) : true;
}

/**
 * The spot to draw this mask at. `ratio` is the photo's width ÷ height (spots are fractions of the
 * photo: x and size of its width, y of its height).
 */
export function placeMask(id: string, f: MaskSpot, ratio: number): MaskSpot {
  const pts = f.pts;
  if (!isHalfMask(id) || !pts || pts.length < 96 || typeof document === "undefined") return f;
  // Work in units of the photo's width, so x and y are on the same scale
  const at = (i: number) => ({ x: pts[2 * i], y: pts[2 * i + 1] / ratio });
  const avg = (a: number, b: number) => {
    let x = 0;
    let y = 0;
    for (let i = a; i <= b; i++) {
      x += at(i).x;
      y += at(i).y;
    }
    return { x: x / (b - a + 1), y: y / (b - a + 1) };
  };
  const eL = avg(36, 41);
  const eR = avg(42, 47);
  const gap = Math.hypot(eR.x - eL.x, eR.y - eL.y);
  if (!gap) return f;
  const mid = { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2 };
  const rad = Math.atan2(eR.y - eL.y, eR.x - eL.x);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = f.sx || 1;
  let s = gap / (EYE_GAP * sx);

  // The drawing's oval centre, from the eye holes sitting on the eyes
  const centre = () => ({ x: mid.x - (OVAL_CY - EYE_Y) * s * sin, y: mid.y + (OVAL_CY - EYE_Y) * s * cos });
  const covered = () => {
    const c = centre();
    return COVER.every((i) => {
      const p = at(i);
      const vx = p.x - c.x;
      const vy = p.y - c.y;
      const x = (vx * cos + vy * sin) / (s * sx) + 100;
      const y = (-vx * sin + vy * cos) / s + OVAL_CY;
      return inShape(id, x, y);
    });
  };
  const base = s;
  while (s < base * MAX_GROW && !covered()) s *= 1.02;
  const c = centre();
  return { ...f, cx: c.x, cy: c.y * ratio, s, rot: Math.round(((rad * 180) / Math.PI) * 10) / 10, sx };
}
