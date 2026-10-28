"use client";

import { Photo } from "@/components/ui/Photo";
import { useEffect, useRef, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import clsx from "clsx";
import { Spinner, tapFeedback } from "@/components/ui/Button";

export const MAX_PHOTOS = 6;

// Hold this long to pick a photo up (a quick swipe still scrolls the page)
const HOLD_MS = 220;

type Drag = {
  url: string;
  /** Where the photo is heading */
  to: number;
  /** Finger position */
  x: number;
  y: number;
  /** Where on the photo it was grabbed (from its centre) */
  gx: number;
  gy: number;
};

export function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  onReorder,
  overlay,
  busyNote,
}: {
  photos: string[];
  onAdd: (file: File) => Promise<void>;
  /** Extra things on each photo (its mask, a pencil to change it) */
  overlay?: (url: string) => React.ReactNode;
  /** Said while a photo is being added */
  busyNote?: string;
  onRemove: (url: string) => void;
  /** Photos moved around: the first one is the main photo */
  onReorder?: (next: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<{ url: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const rects = useRef<DOMRect[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        if (!f.type.startsWith("image/")) continue;
        await onAdd(f);
      }
    } catch (e) {
      setError(e instanceof Error && e.name === "PhotoProblem" ? e.message : "That photo didn't upload. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  // The order while dragging: the held photo moved to where the finger is
  const order = (() => {
    if (!drag) return photos;
    const rest = photos.filter((p) => p !== drag.url);
    rest.splice(drag.to, 0, drag.url);
    return rest;
  })();

  // While a photo is held, the page mustn't scroll (iPhones need this to be set up front)
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (press.current && drag) e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [drag]);

  function nearest(x: number, y: number) {
    let best = 0;
    let d = Infinity;
    rects.current.slice(0, photos.length).forEach((r, i) => {
      const dd = (x - (r.left + r.width / 2)) ** 2 + (y - (r.top + r.height / 2)) ** 2;
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
    return best;
  }

  function down(e: React.PointerEvent, url: string, index: number) {
    if (!onReorder || photos.length < 2 || (e.target as HTMLElement).closest("button")) return;
    const { clientX: x, clientY: y } = e;
    const id = e.pointerId;
    press.current = {
      url,
      x,
      y,
      timer: setTimeout(() => {
        rects.current = cells.current.map((c) => c?.getBoundingClientRect() ?? new DOMRect());
        const r = rects.current[index];
        try {
          grid.current?.setPointerCapture(id);
        } catch {
          /* already lifted */
        }
        tapFeedback();
        setDrag({ url, to: index, x, y, gx: x - (r.left + r.width / 2), gy: y - (r.top + r.height / 2) });
      }, HOLD_MS),
    };
  }

  function move(e: React.PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (!drag) {
      // Moved before the hold finished: it's a scroll, not a pick-up
      if (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8) {
        clearTimeout(p.timer);
        press.current = null;
      }
      return;
    }
    const to = nearest(e.clientX - drag.gx, e.clientY - drag.gy);
    if (to !== drag.to) tapFeedback();
    setDrag({ ...drag, x: e.clientX, y: e.clientY, to });
  }

  function up() {
    const p = press.current;
    if (p) clearTimeout(p.timer);
    press.current = null;
    if (drag) {
      if (order.join() !== photos.join()) onReorder?.(order);
      setDrag(null);
    }
  }

  const slots = Array.from({ length: MAX_PHOTOS });
  return (
    <div>
      <div ref={grid} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="grid grid-cols-3 gap-2.5 select-none">
        {slots.map((_, i) => {
          const url = order[i];
          const isNext = i === photos.length;
          if (url) {
            const held = drag?.url === url;
            const r = rects.current[i];
            const style =
              held && r
                ? { transform: `translate(${drag.x - drag.gx - (r.left + r.width / 2)}px, ${drag.y - drag.gy - (r.top + r.height / 2)}px) scale(1.06)` }
                : undefined;
            return (
              <div
                key={url}
                ref={(el) => {
                  cells.current[i] = el;
                }}
                onPointerDown={(e) => down(e, url, i)}
                onContextMenu={(e) => e.preventDefault()}
                style={style}
                className={clsx(
                  "relative aspect-[3/4] overflow-hidden rounded-2xl bg-line [-webkit-touch-callout:none]",
                  held ? "z-10 shadow-lift ring-[3px] ring-brand" : "transition-transform duration-150",
                  drag && !held && "opacity-90",
                )}
              >
                <Photo
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="pointer-events-none h-full w-full object-cover"
                  fallback={
                    <span className="pointer-events-none absolute inset-0 grid place-items-center bg-chili-soft p-2 text-center text-[12px] leading-snug font-semibold text-chili">
                      This photo won&apos;t load. Remove it and add it again.
                    </span>
                  }
                />
                {!drag && overlay?.(url)}
                {i === 0 ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink">
                    <Star size={11} className="fill-gold text-gold" /> Main
                  </span>
                ) : (
                  onReorder &&
                  !drag && (
                    <button
                      type="button"
                      onClick={() => {
                        tapFeedback();
                        onReorder([url, ...photos.filter((p) => p !== url)]);
                      }}
                      className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"
                      aria-label={`Make photo ${i + 1} your main photo`}
                    >
                      <Star size={11} /> Make main
                    </button>
                  )
                )}
                {!drag && (
                  <button
                    type="button"
                    onClick={() => onRemove(url)}
                    aria-label="Remove photo"
                    className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-white"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            );
          }
          return (
            <button
              key={`slot-${i}`}
              ref={(el) => {
                cells.current[i] = el as unknown as HTMLDivElement;
              }}
              type="button"
              disabled={!isNext || busy}
              onClick={() => input.current?.click()}
              className={clsx(
                "grid aspect-[3/4] place-items-center rounded-2xl border-2 border-dashed transition",
                isNext ? "border-brand/40 bg-brand-soft/50 text-brand" : "border-line text-line-strong",
              )}
              aria-label="Add photo"
            >
              {busy && isNext ? <Spinner className="h-6 w-6" /> : <Plus size={24} />}
            </button>
          );
        })}
      </div>
      {busy && busyNote && <p className="mt-2.5 text-[13px] font-semibold text-brand">{busyNote}</p>}
      {onReorder && photos.length > 1 && (
        <p className="mt-2.5 text-[12px] text-muted">Hold and drag a photo to move it. The first one is your main photo.</p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-chili">{error}</p>}
    </div>
  );
}
