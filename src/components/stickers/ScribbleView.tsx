"use client";

// Showing scribbles (in chats, and live as they're drawn). Kept apart from the drawing tools, so
// opening a chat doesn't load the tools for making them.
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { drawScribble, isLiving, sizeOf, timeline, type Drawing, type Stroke } from "@/lib/scribble";

/** A canvas w px wide (h tall), sharp on high-res screens but not 3× (costly), and under iPhone's size limit */
export function useCanvas(w: number, h: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1, 2048 / Math.max(w, h));
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }, [w, h]);
  return ref;
}

/** How long living brushes keep moving after a scribble has drawn itself (tap to see it again) */
const LIVE_FOR = 6000;

/** A scribble in a chat: draws itself the first time you see it (tap to watch it again). `size` is its width. */
export function ScribbleView({ drawing, size = 170, className, still }: { drawing: Drawing; size?: number; className?: string; /** Just the finished drawing (thumbnails) */ still?: boolean }) {
  const { w, h } = sizeOf(drawing);
  const height = Math.round((size * h) / w);
  const canvas = useCanvas(size, height);
  const [run, setRun] = useState(0);
  const played = useRef(false);

  const play = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return () => {};
    const { times, total } = timeline(drawing);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || still || !total) {
      drawScribble(ctx, drawing, Infinity, times);
      return () => {};
    }
    const length = Math.min(3600, Math.max(1400, total));
    const living = isLiving(drawing);
    const t0 = performance.now();
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / length);
      const after = now - t0 - length;
      if (p < 1) {
        // Mostly steady, like a hand drawing, easing off at the end
        drawScribble(ctx, drawing, total * (0.6 * p + 0.4 * (1 - Math.pow(1 - p, 2))), times, { shadow: false, t: living ? now : undefined });
        raf = requestAnimationFrame(frame);
      } else if (living && after < LIVE_FOR) {
        // Living brushes keep moving for a few seconds (at 25 frames a second, to spare the battery)
        if (now - last >= 40) {
          last = now;
          drawScribble(ctx, drawing, Infinity, times, { shadow: false, t: now });
        }
        raf = requestAnimationFrame(frame);
      } else {
        // At rest: the finished picture, with its soft shadow (the slow part on phones, so only once)
        drawScribble(ctx, drawing, Infinity, times);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvas, drawing, still]);

  // Plays when it first scrolls into view
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let stop = () => {};
    if (run > 0) {
      stop = play();
      return () => stop();
    }
    // Browsers without IntersectionObserver: just play it
    if (typeof IntersectionObserver === "undefined") {
      played.current = true;
      stop = play();
      return () => stop();
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || played.current) return;
      played.current = true;
      stop = play();
    });
    io.observe(c);
    return () => {
      io.disconnect();
      stop();
    };
  }, [canvas, play, run]);

  if (still) return <canvas ref={canvas} style={{ width: size, height }} className={clsx("block", className)} aria-label="Scribble" />;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRun((n) => n + 1);
      }}
      className={clsx("block", className)}
      aria-label="Scribble. Tap to watch it being drawn again"
    >
      <canvas ref={canvas} style={{ width: size, height }} className="block" />
    </button>
  );
}

/** Their scribble as they draw it, where the message will land (no buttons: it just appears) */
export function LiveScribblePreview({ drawing, live, size = 170 }: { drawing: Drawing; live: Stroke | null; size?: number }) {
  const { w, h } = sizeOf(drawing);
  const height = Math.round((size * h) / w);
  const canvas = useCanvas(size, height);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const raf = requestAnimationFrame(() => {
      const d: Drawing = live ? { ...drawing, strokes: [...drawing.strokes, live] } : drawing;
      drawScribble(ctx, d, Infinity, timeline(d).times, { shadow: false });
    });
    return () => cancelAnimationFrame(raf);
  }, [canvas, drawing, live, size, height]);
  const tip = live && live.p.length >= 3 ? { x: (live.p[live.p.length - 3] / w) * size, y: (live.p[live.p.length - 2] / h) * height } : null;
  return (
    <div className="relative my-1 self-start animate-fade-up" aria-label="They're scribbling">
      <canvas ref={canvas} style={{ width: size, height }} className="block rounded-[22px] bg-white/70 ring-1 ring-line" />
      {tip && <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-brand ring-4 ring-white/80" style={{ left: tip.x, top: tip.y }} />}
    </div>
  );
}
