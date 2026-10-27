"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Brush as BrushIcon, Droplets, Eraser, Flame, Heart, Highlighter, Maximize2, Minimize2, PaintBucket, Pencil, PenLine, Plus, Rainbow, Redo2, Sparkles,
  SprayCan, Star, Trash2, Undo2, Waves, Zap,
} from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";
import {
  MAGIC, MAX_SIZE, MIN_SIZE, PAINT, PALETTE, SCRIBBLE_MAX_POINTS, START_COLOURS, brushName, drawScribble, isLiving, pointCount, sizeOf, timeline,
  type Brush, type Drawing, type Stroke,
} from "@/lib/scribble";

const ICONS: Record<Brush, React.ComponentType<{ size?: number; className?: string }>> = {
  pencil: Pencil,
  pen: PenLine,
  brush: BrushIcon,
  water: Droplets,
  marker: Highlighter,
  spray: SprayCan,
  fill: PaintBucket,
  eraser: Eraser,
  neon: Zap,
  rainbow: Rainbow,
  glitter: Sparkles,
  wobble: Waves,
  fire: Flame,
  hearts: Heart,
  stars: Star,
};

/** A canvas w px wide (h tall), sharp on high-res screens but not 3× (costly), and under iPhone's size limit */
function useCanvas(w: number, h: number) {
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

type Drawer = "brushes" | "colours" | "size" | null;

/** Draw and paint. Every line is saved with its timing, so it draws itself again when they see it. */
export function ScribblePad({
  drawing,
  onChange,
  maxSize = 360,
  expanded,
  onExpand,
}: {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  /** Widest the board gets (bigger when expanded) */
  maxSize?: number;
  expanded?: boolean;
  /** Switch between the small and the big board */
  onExpand?: () => void;
}) {
  const { w: unitsW, h: unitsH } = sizeOf(drawing);
  const [box, setBox] = useState(300);
  const boxH = Math.round((box * unitsH) / unitsW);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useCanvas(box, boxH);
  const [tool, setTool] = useState<Brush>("brush");
  const [lastBrush, setLastBrush] = useState<Brush>("brush");
  const [ink, setInk] = useState(START_COLOURS[1]);
  const [recent, setRecent] = useState<string[]>(START_COLOURS);
  const [width, setWidth] = useState(9);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [full, setFull] = useState(false);
  const redo = useRef<Stroke[]>([]);
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

  // What's already drawn is kept as a picture, so each finger move only draws the line in progress
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
      if (!l) return;
      const one: Drawing = { ...draft.current, strokes: [l.stroke] };
      // The eraser rubs out what's already there, so it's drawn over a copy of everything
      if (l.stroke.b === "eraser") {
        const all: Drawing = { ...draft.current, strokes: [...draft.current.strokes, l.stroke] };
        drawScribble(ctx, all, Infinity, timeline(all).times, { shadow: false });
      } else drawScribble(ctx, one, Infinity, timeline(one).times, { clear: false, shadow: false });
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
  }, [drawing, box, boxH, paint, canvas]);

  function at(e: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    const k = unitsW / r.width;
    return [Math.max(0, Math.min(unitsW, Math.round((e.clientX - r.left) * k))), Math.max(0, Math.min(unitsH, Math.round((e.clientY - r.top) * k)))];
  }

  function commit(s: Stroke) {
    redo.current = [];
    onChange({ ...draft.current, strokes: [...draft.current.strokes, s] });
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (live.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    setDrawer(null);
    if (pointCount(drawing) >= SCRIBBLE_MAX_POINTS) return setFull(true);
    tapFeedback();
    const [x, y] = at(e);
    // Fill: one tap paints the area in watercolour
    if (tool === "fill") return commit({ b: "fill", c: ink, s: 0, p: [x, y, 0] });
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { stroke: { b: tool, c: ink, s: width, p: [x, y, 0] }, last: performance.now(), id: e.pointerId };
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
    commit(l.stroke);
  }

  function pickBrush(b: Brush) {
    tapFeedback();
    setTool(b);
    setLastBrush(b);
    setDrawer(null);
  }
  function pickColour(c: string) {
    tapFeedback();
    setInk(c);
    setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 3));
    if (tool === "eraser") setTool(lastBrush);
    setDrawer(null);
  }

  const empty = drawing.strokes.length === 0;
  const BrushNow = ICONS[lastBrush];
  const usesInk = tool !== "eraser" && tool !== "rainbow";
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
          style={{ width: box, height: boxH, WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
          className={clsx("mx-auto block touch-none rounded-[28px] bg-white shadow-[0_1px_2px_rgb(28_24_40/0.06),0_8px_28px_-12px_rgb(28_24_40/0.25)] ring-1 ring-line", tool === "fill" && "cursor-cell")}
          aria-label="Drawing board"
        />
        {empty && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-12 text-center text-[15px] font-medium text-muted/70">Draw or paint anything</p>
        )}
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          <RoundBtn label="Undo" disabled={empty} onClick={() => {
            setFull(false);
            redo.current.push(drawing.strokes[drawing.strokes.length - 1]);
            onChange({ ...drawing, strokes: drawing.strokes.slice(0, -1) });
          }}>
            <Undo2 size={17} />
          </RoundBtn>
          <RoundBtn label="Redo" disabled={!redo.current.length} onClick={() => {
            const s = redo.current.pop();
            if (s) onChange({ ...drawing, strokes: [...drawing.strokes, s] });
          }}>
            <Redo2 size={17} />
          </RoundBtn>
          <RoundBtn label="Start again" disabled={empty} onClick={() => {
            setFull(false);
            redo.current = [];
            onChange({ ...drawing, strokes: [] });
          }}>
            <Trash2 size={16} />
          </RoundBtn>
        </div>
        {onExpand && (
          <div className="absolute top-2.5 left-2.5">
            <RoundBtn label={expanded ? "Smaller board" : "Bigger board"} onClick={onExpand}>
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </RoundBtn>
          </div>
        )}
        {full && <p className="absolute inset-x-0 bottom-3 text-center text-[12.5px] font-semibold text-chili">That&apos;s plenty of paint! Send it or undo a line.</p>}
      </div>

      {/* One toolbar: brush, fill, eraser · colours · size */}
      <div className="mx-auto flex items-center gap-1 rounded-[22px] bg-cream p-1.5" style={{ maxWidth: maxSize }}>
        <ToolBtn
          on={tool === lastBrush}
          label={`${brushName(lastBrush)} (tap again for more brushes)`}
          onClick={() => (tool === lastBrush ? setDrawer(drawer === "brushes" ? null : "brushes") : pickBrush(lastBrush))}
        >
          <BrushNow size={20} />
        </ToolBtn>
        <ToolBtn on={tool === "fill"} label="Fill" onClick={() => { tapFeedback(); setTool("fill"); setDrawer(null); }}>
          <PaintBucket size={20} />
        </ToolBtn>
        <ToolBtn on={tool === "eraser"} label="Eraser" onClick={() => { tapFeedback(); setTool("eraser"); setDrawer(null); }}>
          <Eraser size={20} />
        </ToolBtn>
        <span className="mx-1 h-7 w-px bg-line-strong" />
        <div className={clsx("flex items-center gap-1.5", !usesInk && "opacity-40")}>
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColour(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={ink === c}
              className={clsx("h-8 w-8 rounded-full transition active:scale-90", ink === c ? "ring-2 ring-ink ring-offset-2 ring-offset-cream" : "ring-1 ring-ink/15")}
              style={{ background: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => { tapFeedback(); setDrawer(drawer === "colours" ? null : "colours"); }}
            aria-label="More colours"
            aria-expanded={drawer === "colours"}
            className={clsx("grid h-8 w-8 place-items-center rounded-full transition active:scale-90", drawer === "colours" ? "bg-ink text-white" : "bg-surface text-ink-soft ring-1 ring-ink/10")}
          >
            <Plus size={17} />
          </button>
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => { tapFeedback(); setDrawer(drawer === "size" ? null : "size"); }}
          aria-label="Brush size"
          aria-expanded={drawer === "size"}
          className={clsx("grid h-10 w-10 place-items-center rounded-full transition active:scale-90", drawer === "size" ? "bg-ink" : "bg-surface ring-1 ring-ink/10")}
        >
          <span className="rounded-full" style={{ width: 4 + (width / MAX_SIZE) * 20, height: 4 + (width / MAX_SIZE) * 20, background: drawer === "size" ? "#ffffff" : tool === "eraser" ? "#a8a3b5" : ink === "#ffffff" ? "#d8d3e4" : ink }} />
        </button>
      </div>

      {drawer === "brushes" && (
        <div className="mx-auto animate-fade-up space-y-2.5 rounded-[22px] bg-cream p-3" style={{ maxWidth: maxSize }}>
          {[["Paint", PAINT], ["Magic", MAGIC]].map(([title, list]) => (
            <div key={title as string}>
              <p className="mb-1.5 px-1 text-[11.5px] font-bold tracking-wide text-muted uppercase">{title as string}</p>
              <div className="flex flex-wrap gap-1.5">
                {(list as typeof PAINT).map((b) => {
                  const I = ICONS[b.id];
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pickBrush(b.id)}
                      aria-pressed={lastBrush === b.id}
                      className={clsx(
                        "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition active:scale-95",
                        lastBrush === b.id ? "bg-ink text-white" : "bg-surface text-ink-soft",
                      )}
                    >
                      <I size={16} /> {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {drawer === "colours" && (
        <div className="mx-auto grid animate-fade-up grid-cols-8 gap-2 rounded-[22px] bg-cream p-3" style={{ maxWidth: maxSize }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColour(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={ink === c}
              className={clsx("aspect-square rounded-full transition active:scale-90", ink === c ? "ring-2 ring-ink ring-offset-2 ring-offset-cream" : "ring-1 ring-ink/10")}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      {drawer === "size" && (
        <div className="mx-auto flex animate-fade-up items-center gap-3 rounded-[22px] bg-cream px-4 py-3" style={{ maxWidth: maxSize }}>
          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="h-2 flex-1 accent-brand"
            aria-label="Brush size"
          />
          <span className="h-5 w-5 rounded-full bg-ink-soft" />
        </div>
      )}
    </div>
  );
}

function RoundBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-soft shadow-card ring-1 ring-ink/5 backdrop-blur transition active:scale-90 disabled:opacity-35"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ToolBtn({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={clsx("grid h-10 w-10 place-items-center rounded-full transition active:scale-90", on ? "bg-ink text-white" : "text-ink-soft hover:bg-surface")}
    >
      {children}
    </button>
  );
}

export const emptyDrawing = (w?: number, h?: number): Drawing => (w && h ? { v: 1, strokes: [], w, h } : { v: 1, strokes: [] });
