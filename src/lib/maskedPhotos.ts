/**
 * Masking photos, on the phone: find the faces, cover each with a masquerade mask, and draw the
 * masked copy that everyone sees. The face finder (a small model, about 300 KB) loads only when
 * someone adds or edits a photo.
 */
import type { MaskSpot, PhotoMask } from "./types";
import { maskUrl, MASKS } from "./masks";
import { compress } from "./photos";

// The mask drawing: a -10,-30 220×220 square; the face oval inside it is centred at (100,112), radii 48 × 54
const VB = { x: -10, y: -30, w: 220, h: 220 };
const OVAL = { cx: 100, cy: 112, rx: 48, ry: 54 };

/** Masks picked for you, a different one for each photo */
export const STARTER_MASKS = ["venetian", "fox", "hearteyes", "flowers", "cat", "shades", "butterfly", "kitsune", "unicorn", "owl", "moon", "party"];
export { PLACEHOLDER } from "./photoSet";

type FaceApi = typeof import("@vladmandic/face-api");
let finder: Promise<FaceApi> | null = null;

/** The face finder, loaded once */
function getFinder() {
  finder ??= (async () => {
    const fa = await import("@vladmandic/face-api");
    await fa.nets.tinyFaceDetector.loadFromUri("/models");
    await fa.nets.faceLandmark68TinyNet.loadFromUri("/models").catch(() => null);
    return fa;
  })();
  finder.catch(() => (finder = null));
  return finder;
}

type Found = { box: { x: number; y: number; w: number; h: number }; yaw: number; roll: number; region: [number, number][] | null };

/** Faces in a picture: their outline (eyes, nose, jaw, brows plus the forehead), which way they look, and their tilt */
async function findFaces(img: HTMLCanvasElement): Promise<Found[]> {
  const fa = await getFinder();
  for (const [inputSize, scoreThreshold] of [
    [416, 0.5],
    [608, 0.35],
  ]) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
    let found: { detection: { box: { x: number; y: number; width: number; height: number } }; landmarks: { positions: { x: number; y: number }[] } }[] = [];
    try {
      found = (await fa.detectAllFaces(img, opts).withFaceLandmarks(true)) as unknown as typeof found;
    } catch {
      found = [];
    }
    if (found.length) return found.map((f) => outline(f.detection.box, f.landmarks.positions));
    const boxes = await fa.detectAllFaces(img, opts);
    if (boxes.length) return boxes.map((b) => ({ box: { x: b.box.x, y: b.box.y, w: b.box.width, h: b.box.height }, yaw: 0, roll: 0, region: null }));
  }
  return [];
}

function outline(box: { x: number; y: number; width: number; height: number }, pts: { x: number; y: number }[]): Found {
  const avg = (a: number, b: number) => {
    let x = 0;
    let y = 0;
    for (let i = a; i <= b; i++) {
      x += pts[i].x;
      y += pts[i].y;
    }
    return { x: x / (b - a + 1), y: y / (b - a + 1) };
  };
  const eL = avg(36, 41);
  const eR = avg(42, 47);
  const nose = pts[30];
  const chin = pts[8];
  const eyeDist = Math.hypot(eR.x - eL.x, eR.y - eL.y) || 1;
  const midX = (eL.x + eR.x) / 2;
  const yaw = Math.max(-60, Math.min(60, ((nose.x - midX) / (eyeDist / 2)) * 55));
  const roll = (Math.atan2(eR.y - eL.y, eR.x - eL.x) * 180) / Math.PI;
  const lift = (chin.y - avg(17, 26).y) * 0.32;
  const region: [number, number][] = pts.map((p) => [p.x, p.y]);
  for (let i = 17; i <= 26; i++) region.push([pts[i].x, pts[i].y - lift]);
  return { box: { x: box.x, y: box.y, w: box.width, h: box.height }, yaw, roll, region };
}

type Spot = { cx: number; cy: number; s: number; rot: number; sx: number };

function inside(m: Spot, px: number, py: number) {
  const dx = px - m.cx;
  const dy = py - m.cy;
  const r = (-m.rot * Math.PI) / 180;
  const x = dx * Math.cos(r) - dy * Math.sin(r);
  const y = dx * Math.sin(r) + dy * Math.cos(r);
  const rx = OVAL.rx * m.s * m.sx * 0.97;
  const ry = OVAL.ry * m.s * 0.97;
  return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
}

/** A mask over one face: turned and tilted the way the face is, grown until every point of it is covered */
function spotFor(f: Found): Spot {
  const sx = Math.max(0.62, Math.cos((f.yaw * Math.PI) / 180));
  if (!f.region) {
    const s = Math.max((f.box.w * 1.3) / (OVAL.rx * 2), (f.box.h * 1.35) / (OVAL.ry * 2));
    return { cx: f.box.x + f.box.w / 2, cy: f.box.y + f.box.h * 0.48, s, rot: 0, sx: 1 };
  }
  const xs = f.region.map((p) => p[0]);
  const ys = f.region.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m: Spot = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 + (maxY - minY) * 0.03, rot: f.roll, sx, s: 0 };
  m.s = Math.max((maxX - minX) / (OVAL.rx * 2 * sx), (maxY - minY) / (OVAL.ry * 2)) * 1.02;
  for (let k = 0; k < 30 && !f.region.every(([x, y]) => inside(m, x, y)); k++) m.s *= 1.03;
  m.s *= 1.06;
  return m;
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => no(new Error("Couldn't draw the mask"));
    i.src = src;
  });

/** A picture as a canvas (at most 1280 on the long side) */
export async function toCanvas(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close?.();
  return c;
}

/** The masked copy: the photo with each face covered */
export async function drawMasked(photo: HTMLCanvasElement, mask: Exclude<PhotoMask, { none: true }>): Promise<Blob> {
  const out = document.createElement("canvas");
  out.width = photo.width;
  out.height = photo.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(photo, 0, 0);
  const img = await loadImg(maskUrl(mask.mask, mask.color, mask.trim));
  for (const f of mask.faces) {
    ctx.save();
    ctx.translate(f.cx * out.width, f.cy * out.height);
    ctx.rotate((f.rot * Math.PI) / 180);
    const s = f.s * out.width;
    ctx.scale(s * f.sx, s);
    ctx.drawImage(img, VB.x - OVAL.cx, VB.y - OVAL.cy, VB.w, VB.h);
    ctx.restore();
  }
  return new Promise((ok, no) => out.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't save the masked photo"))), "image/jpeg", 0.88));
}

export type Prepared =
  | { kind: "faces"; photo: Blob; canvas: HTMLCanvasElement; mask: Exclude<PhotoMask, { none: true }> }
  | { kind: "none"; photo: Blob; canvas: HTMLCanvasElement };

/** A new photo: shrink it, find the faces, and pick a mask for them */
export async function prepare(file: Blob, maskId: string): Promise<Prepared> {
  const photo = await compress(file);
  const canvas = await toCanvas(photo);
  const mask = await maskFor(canvas, maskId);
  return mask ? { kind: "faces", photo, canvas, mask } : { kind: "none", photo, canvas };
}

/** The mask for a photo's faces (null: no face found). Positions are fractions of the photo, so they work at any size. */
export async function maskFor(canvas: HTMLCanvasElement, maskId: string): Promise<Exclude<PhotoMask, { none: true }> | null> {
  const found = await findFaces(canvas);
  if (!found.length) return null;
  const faces: MaskSpot[] = found.map(spotFor).map((m) => ({ cx: m.cx / canvas.width, cy: m.cy / canvas.height, s: m.s / canvas.width, rot: m.rot, sx: m.sx }));
  return { mask: maskId, color: null, trim: "gold", faces };
}

/** An original photo you already have, as a canvas (fetched through Dashpad so it can be drawn on) */
export async function loadOriginal(url: string) {
  const via = await fetch(`/api/media/original?url=${encodeURIComponent(url)}`).catch(() => null);
  if (via?.ok) return toCanvas(await via.blob());
  // Straight from storage (works where the photo's host allows it)
  const direct = await fetch(url, { mode: "cors", cache: "no-store" }).catch(() => null);
  if (direct?.ok) return toCanvas(await direct.blob());
  throw new Error("Couldn't open that photo. Please try again.");
}

/** The next starter mask for a photo, so each photo gets a different one */
export function starterMask(used: string[]) {
  return STARTER_MASKS.find((id) => !used.includes(id)) ?? STARTER_MASKS[used.length % STARTER_MASKS.length];
}

export const maskName = (id: string) => MASKS.find((m) => m.id === id)?.name ?? "Mask";
