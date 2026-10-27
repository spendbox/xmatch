"use client";

// Design previews for painting and drawing together (sample data, not wired up)
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { ScribblePad } from "@/components/stickers/Scribble";
import { ScribbleView } from "@/components/stickers/ScribbleView";
import { TOGETHER_H, TOGETHER_W, drawScribble, timeline, type Drawing, type Stroke } from "@/lib/scribble";

const line = (pts: [number, number][], b: Stroke["b"], c: string, s: number): Stroke => {
  const p: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 5));
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) p.push(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps), 16);
  }
  return { b, c, s, p };
};
const curve = (f: (t: number) => [number, number], n = 50) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const ring = (cx: number, cy: number, rx: number, ry = rx, n = 40) => curve((t) => [cx + Math.cos(t * Math.PI * 2) * rx, cy + Math.sin(t * Math.PI * 2) * ry], n);
const fill = (x: number, y: number, c: string): Stroke => ({ b: "fill", c, s: 0, p: [x, y, 0] });

/** A little painting: watercolour sky, a sun, a flower outlined in ink and filled in watercolour */
export const paintSample = (w = 300, h = 300): Drawing => {
  const sx = w / 300;
  const X = (x: number) => Math.round(x * sx);
  return {
    v: 1,
    w,
    h,
    strokes: [
      line(curve((t) => [X(20 + t * 260), 40 + Math.sin(t * 9) * 6]), "water", "#38bdf8", 22),
      line(curve((t) => [X(30 + t * 240), 70 + Math.sin(t * 7 + 1) * 6]), "water", "#4d7cfe", 18),
      line(ring(X(250), 52, 18), "spray", "#ffb02e", 10),
      line(ring(X(150), 120, 26), "pen", "#1c1828", 4),
      line(ring(X(118), 150, 22), "pen", "#1c1828", 4),
      line(ring(X(182), 150, 22), "pen", "#1c1828", 4),
      line(ring(X(150), 150, 14), "pen", "#1c1828", 4),
      fill(X(150), 104, "#ff7aa8"),
      fill(X(104), 150, "#ff4d7e"),
      fill(X(196), 150, "#ff7aa8"),
      fill(X(150), 150, "#ffd93d"),
      line(curve((t) => [X(150 + Math.sin(t * 3) * 6), 172 + t * 100]), "brush", "#2f9e5b", 12),
      line(curve((t) => [X(156 + t * 50), 230 - Math.sin(t * Math.PI) * 26], 30), "brush", "#6bcB77", 14),
      line(curve((t) => [X(20 + t * 260), 278 + Math.sin(t * 12) * 3]), "marker", "#c5e063", 14),
    ],
  };
};

function Board({ w, h, drawing }: { w: number; h: number; drawing: Drawing }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = w * 2;
    c.height = h * 2;
    drawScribble(ctx, drawing, Infinity, timeline(drawing).times);
  }, [w, h, drawing]);
  return <canvas ref={ref} style={{ width: w, height: h }} className="block rounded-[24px] bg-white ring-1 ring-line" />;
}

export function PaintSampleMock() {
  return (
    <div className="grid min-h-dvh place-items-center bg-cream p-4">
      <div data-paint>
        <Board w={340} h={340} drawing={paintSample()} />
      </div>
    </div>
  );
}

const Avatar = ({ letter, color }: { letter: string; color: string }) => (
  <span className="relative grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-white ring-2 ring-surface" style={{ background: color }}>
    {letter}
    <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-surface" />
  </span>
);

const together = paintSample(TOGETHER_W, TOGETHER_H);

/** Drawing together: the big shared board (2), and the wide painting it sends to the chat (3) */
export function TogetherMock({ step }: { step: 2 | 3 }) {
  const [d, setD] = useState<Drawing>(together);
  if (step === 2)
    return (
      <div className="flex h-dvh flex-col bg-surface">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button className="grid h-10 w-10 place-items-center rounded-full text-ink-soft" aria-label="Back">
            <ArrowLeft size={21} />
          </button>
          <div className="flex -space-x-2">
            <Avatar letter="Y" color="#7a5cf0" />
            <Avatar letter="A" color="#2fb3a0" />
          </div>
          <p className="min-w-0 flex-1 pl-1 text-[16px] font-semibold">Drawing with Ada</p>
          <button className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[14.5px] font-semibold text-white">
            <SendHorizontal size={16} /> Send
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-center px-3 pb-6">
          <ScribblePad drawing={d} onChange={setD} maxSize={420} expanded />
        </div>
      </div>
    );

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5">
        <ArrowLeft size={22} />
        <Avatar letter="A" color="#2fb3a0" />
        <div>
          <p className="text-[16px] font-semibold">Ada</p>
          <p className="text-[12px] font-semibold text-mint">Online</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <div className="max-w-[78%] self-start rounded-[20px] rounded-bl-md bg-surface px-4 py-2.5 text-[15px] shadow-card">Okay that came out so cute</div>
        <div className="my-2 flex flex-col items-center">
          <div className="overflow-hidden rounded-[24px] bg-white p-1.5 shadow-card ring-1 ring-line">
            <ScribbleView drawing={together} size={346} />
          </div>
          <span className="mt-1.5 text-[12px] font-semibold text-muted">🎨 You &amp; Ada · 9:41 PM</span>
        </div>
      </div>
      <div className="border-t border-line bg-surface px-3 pt-2.5 pb-6">
        <span className="flex h-11 items-center rounded-full border border-line bg-cream px-4 text-[15px] text-muted">Message Ada</span>
      </div>
    </div>
  );
}
