/**
 * Where a mask is drawn on a face: the spot found for the whole face, then the person's own
 * changes on top (moved, resized, turned in Move & resize).
 */
import type { MaskAdj, MaskSpot } from "./types";

export const NO_ADJ: MaskAdj = { x: 0, y: 0, k: 1, r: 0 };

/** The spot the mask was placed at for this face (before the person's own changes) */
export function placeMask(_id: string, f: MaskSpot): MaskSpot {
  return f;
}

/**
 * How far a mask can be changed. Every mask must keep hiding the face, so it can be fine-tuned
 * (bigger, a little smaller, nudged and turned) but not moved off the face.
 */
export function adjLimits(_id: string) {
  return { kMin: 0.85, kMax: 1.6, move: 0.22, turn: 45 };
}

/** A change kept within the limits (move is measured against the mask's own size) */
export function clampAdj(id: string, base: MaskSpot, a: MaskAdj, ratio: number): MaskAdj {
  const l = adjLimits(id);
  const k = Math.min(l.kMax, Math.max(l.kMin, a.k));
  const r = Math.min(l.turn, Math.max(-l.turn, a.r));
  // Offset in photo widths (y is a fraction of the height, so convert)
  const ox = a.x;
  const oy = a.y / ratio;
  const max = l.move * base.s * 130;
  const len = Math.hypot(ox, oy);
  const f = len > max && len > 0 ? max / len : 1;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return { x: round(ox * f), y: round(oy * f * ratio), k: Math.round(k * 1000) / 1000, r: Math.round(r * 10) / 10 };
}

/** Where the mask is drawn: placed on the face, then the person's own changes */
export function finalSpot(id: string, f: MaskSpot, _ratio: number): MaskSpot {
  const b = placeMask(id, f);
  const a = f.adj;
  if (!a) return b;
  return { ...b, cx: b.cx + a.x, cy: b.cy + a.y, s: b.s * a.k, rot: b.rot + a.r };
}
