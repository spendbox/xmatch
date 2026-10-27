"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Eraser, Maximize2, Minimize2, Undo2 } from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";
import { BRUSHES, INKS, SCRIBBLE_MAX_POINTS, SCRIBBLE_SIZE, WIDTHS, drawScribble, pointCount, timeline, type Brush, type Drawing, type Stroke } from "@/lib/scribble";

function useCanvas(size: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Sharp enough on high-res screens, without the cost of 3× (and under the size iPhones allow)
    const dpr = Math.min(2, window.devicePixelRatio || 1, 2048 / size);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
  }, [size]);
  return ref;
}

/** A scribble in a chat: draws itself the first time you see it (tap to watch it again) */
export function ScribbleView({ drawing, size = 170, className, still }: { drawing: Drawing; size?: number; className?: string; /** Just the finished drawing (thumbnails) */ still?: boolean }) {
  const canvas = useCanvas(size);
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
    const length = Math.min(3200, Math.max(1400, total));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / length);
      // Mostly steady, like a hand drawing, easing off at the end
      // The soft shadow only on the last frame: it's the slow part on phones
      drawScribble(ctx, drawing, p >= 1 ? Infinity : total * (0.6 * p + 0.4 * (1 - Math.pow(1 - p, 2))), times, { shadow: p >= 1 });
      if (p < 1) raf = requestAnimationFrame(frame);
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

  if (still) return <canvas ref={canvas} style={{ width: size, height: size }} className={clsx("block", className)} aria-label="Scribble" />;
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
      <canvas ref={canvas} style={{ width: size, height: size }} className="block" />
    </button>
  );
}

/** Draw a scribble. Every line is saved with its timing, so it draws itself again when they see it. */
export function ScribblePad({
  drawing,
  onChange,
  maxSize = 360,
  expanded,
  onExpand,
}: {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  /** Largest the drawing space gets (bigger when expanded) */
  maxSize?: number;
  expanded?: boolean;
  /** Switch between the small and the big drawing space */
  onExpand?: () => void;
}) {
  const [box, setBox] = useState(300);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useCanvas(box);
  const [brush, setBrush] = useState<Brush>("neon");
  const [ink, setInk] = useState("#ff7aa8");
  const [width, setWidth] = useState(WIDTHS[1]);
  const [full, setFull] = useState(false);
  const live = useRef<{ stroke: Stroke; last: number; id: number } | null>(null);
  const draft = useRef(drawing);
  draft.current = drawing;
  const raf = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setBox(Math.max(200, Math.min(maxSize, Math.round(el.clientWidth))));
    fit();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxSize]);

  // The lines already drawn are kept as a picture, so each finger move only draws the line in progress
  const done = useRef<HTMLCanvasElement | null>(null);
  const paint = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx || !done.current) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(done.current, 0, 0);
      const l = live.current;
      if (l) drawScribble(ctx, { v: 1, strokes: [l.stroke] }, Infinity, timeline({ v: 1, strokes: [l.stroke] }).times, { clear: false, shadow: false });
    });
  }, [canvas]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const d = (done.current ??= document.createElement("canvas"));
    d.width = c.width;
    d.height = c.height;
    const ctx = d.getContext("2d");
    if (ctx) drawScribble(ctx, drawing, Infinity, timeline(drawing).times);
    paint();
  }, [drawing, box, paint, canvas]);

  function at(e: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    const k = SCRIBBLE_SIZE / r.width;
    return [Math.max(0, Math.min(SCRIBBLE_SIZE, Math.round((e.clientX - r.left) * k))), Math.max(0, Math.min(SCRIBBLE_SIZE, Math.round((e.clientY - r.top) * k)))];
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (live.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (pointCount(drawing) >= SCRIBBLE_MAX_POINTS) return setFull(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    tapFeedback();
    const [x, y] = at(e);
    live.current = { stroke: { b: brush, c: ink, s: width, p: [x, y, 0] }, last: performance.now(), id: e.pointerId };
    paint();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (!l || e.pointerId !== l.id) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = at(ev);
      const p = l.stroke.p;
      if (Math.hypot(x - p[p.length - 3], y - p[p.length - 2]) < 2) continue;
      if (pointCount(draft.current) + p.length / 3 >= SCRIBBLE_MAX_POINTS) {
        setFull(true);
        break;
      }
      const now = performance.now();
      p.push(x, y, Math.min(255, Math.round(now - l.last)));
      l.last = now;
    }
    paint();
  }
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (!l || e.pointerId !== l.id) return;
    live.current = null;
    onChange({ ...draft.current, strokes: [...draft.current.strokes, l.stroke] });
  }

  const empty = drawing.strokes.length === 0;
  return (
    <div className="space-y-3">
      <div ref={wrap} className="relative mx-auto w-full" style={{ maxWidth: maxSize }}>
        <canvas
          ref={canvas}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: box, height: box, WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
          className="mx-auto block touch-none rounded-[28px] bg-[#f6f2fd] ring-1 ring-brand/15"
          aria-label="Drawing space"
        />
        {empty && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-10 text-center text-[15px] font-medium text-brand/60">
            Draw anything. It&apos;ll draw itself again when they see it ✨
          </p>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              onExpand();
            }}
            className="absolute top-2.5 left-2.5 grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card transition active:scale-90"
            aria-label={expanded ? "Make the drawing space smaller" : "Make the drawing space bigger"}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        )}
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          <button
            type="button"
            disabled={empty}
            onClick={() => {
              tapFeedback();
              setFull(false);
              onChange({ ...drawing, strokes: drawing.strokes.slice(0, -1) });
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card transition active:scale-90 disabled:opacity-40"
            aria-label="Undo"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={() => {
              tapFeedback();
              setFull(false);
              onChange({ ...drawing, strokes: [] });
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card transition active:scale-90 disabled:opacity-40"
            aria-label="Clear"
          >
            <Eraser size={17} />
          </button>
        </div>
        {full && <p className="absolute inset-x-0 bottom-2 text-center text-[12.5px] font-semibold text-chili">That&apos;s plenty of ink! Send it or undo a line.</p>}
      </div>

      {/* Brushes */}
      <div className="grid grid-cols-4 gap-1.5">
        {BRUSHES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              tapFeedback();
              setBrush(b.id);
            }}
            aria-pressed={brush === b.id}
            className={clsx(
              "flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[12px] font-semibold transition active:scale-95",
              brush === b.id ? "bg-ink text-white" : "bg-cream text-ink-soft",
            )}
          >
            <BrushSwatch brush={b.id} ink={ink} dark={brush === b.id} />
            {b.name}
          </button>
        ))}
      </div>

      {/* Ink and thickness */}
      <div className="flex items-center gap-2">
        <div className={clsx("flex flex-1 items-center justify-between", brush === "rainbow" && "pointer-events-none opacity-30")}>
          {INKS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setInk(c)}
              aria-label={`Ink ${c}`}
              aria-pressed={ink === c}
              className={clsx("h-7 w-7 rounded-full ring-offset-2 transition active:scale-90", ink === c ? "ring-2 ring-ink" : "ring-1 ring-line-strong")}
              style={{ background: c }}
            />
          ))}
        </div>
        <span className="h-7 w-px bg-line" />
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            aria-label={`Line ${w === WIDTHS[0] ? "thin" : w === WIDTHS[1] ? "medium" : "thick"}`}
            aria-pressed={width === w}
            className={clsx("grid h-8 w-8 place-items-center rounded-full transition active:scale-90", width === w ? "bg-ink" : "bg-cream")}
          >
            <span className="rounded-full" style={{ width: w * 0.9, height: w * 0.9, background: width === w ? "#ffffff" : "#1c1828" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function BrushSwatch({ brush, ink, dark }: { brush: Brush; ink: string; dark: boolean }) {
  const d = "M3 13 C 9 3, 15 17, 21 7";
  if (brush === "rainbow")
    return (
      <svg width="26" height="18" viewBox="0 0 24 18" aria-hidden>
        <defs>
          <linearGradient id="rb" x1="0" x2="1">
            <stop offset="0" stopColor="#ff4d6d" />
            <stop offset="0.35" stopColor="#ffd166" />
            <stop offset="0.65" stopColor="#2fb3a0" />
            <stop offset="1" stopColor="#7a5cf0" />
          </linearGradient>
        </defs>
        <path d={d} stroke="url(#rb)" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="26" height="18" viewBox="0 0 24 18" aria-hidden style={brush === "neon" ? { filter: `drop-shadow(0 0 3px ${ink})` } : undefined}>
      <path d={d} stroke={ink === "#ffffff" && !dark ? "#d8d3e4" : ink} strokeWidth="4" fill="none" strokeLinecap="round" />
      {brush === "neon" && <path d={d} stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      {brush === "glitter" && (
        <>
          <circle cx="7" cy="5" r="1.4" fill="#ffe08a" />
          <circle cx="14" cy="14" r="1.2" fill="#ffe08a" />
          <circle cx="19" cy="3.5" r="1.1" fill={dark ? "#ffffff" : "#ffb02e"} />
        </>
      )}
    </svg>
  );
}

export const emptyDrawing = (): Drawing => ({ v: 1, strokes: [] });
