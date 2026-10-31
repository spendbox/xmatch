"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Hand, Pencil, Plus, X } from "lucide-react";
import { promptOf, splitOwn, type Thing } from "@/lib/things";
import { tapFeedback } from "@/components/ui/Button";

/** Answer size from its length only: nothing to measure, so it can't go wrong on any phone */
function answerSize(text: string, big: boolean) {
  const n = text.trim().length;
  if (big)
    return n <= 20 ? 34 : n <= 40 ? 30 : n <= 70 ? 26 : n <= 110 ? 23 : 20;
  return n <= 20 ? 24 : n <= 40 ? 21 : n <= 70 ? 18 : n <= 110 ? 16 : 15;
}

/**
 * One card: the question in a small label on top, the full answer underneath. The card keeps its
 * shape for short answers and simply grows taller for long ones, so every word always shows.
 */
export function CardFace({
  thing,
  big,
  wide,
}: {
  thing: Thing;
  big?: boolean;
  /** A shorter shape (in Break the ice) */ wide?: boolean;
}) {
  const p = promptOf(thing.p);
  // "Something else about me": their own question is the label, their answer the big words
  const own = splitOwn(thing);
  return (
    <div
      className="relative grid h-full w-full overflow-hidden text-left text-white"
      style={{ background: p.tone }}
    >
      {/* Sets the card's usual shape; a longer answer makes it taller instead of being cut */}
      <span
        aria-hidden
        className={clsx(
          "col-start-1 row-start-1 block w-full",
          wide ? "aspect-[4/3]" : big ? "aspect-[3/4]" : "aspect-[4/3.1]",
        )}
      />
      <span
        aria-hidden
        className={clsx(
          "absolute rounded-full bg-white/10",
          big ? "-top-20 -right-16 h-56 w-56" : "-top-10 -right-10 h-28 w-28",
        )}
      />
      <span
        aria-hidden
        className={clsx(
          "absolute rounded-full bg-black/10",
          big
            ? "-bottom-24 -left-14 h-52 w-52"
            : "-bottom-12 -left-8 h-24 w-24",
        )}
      />
      <div
        className={clsx(
          "relative col-start-1 row-start-1 flex min-w-0 flex-col",
          big ? "p-6" : "p-4",
        )}
      >
        <span
          className={clsx(
            "w-fit max-w-full rounded-2xl bg-black/20 font-semibold break-words text-white/90",
            big
              ? "px-3 py-1 text-[13.5px] leading-snug"
              : "px-2.5 py-0.5 text-[11px] leading-snug",
          )}
        >
          {own.q ?? p.text}
        </span>
        <p
          className={clsx(
            "mt-auto font-display leading-[1.2] font-semibold break-words whitespace-pre-line",
            big ? "pt-5" : "pt-3",
          )}
          style={{ fontSize: answerSize(own.a, !!big) }}
        >
          {own.a}
        </p>
      </div>
    </div>
  );
}

/**
 * "Things about…" as a deck of cards. Tap the deck to open the cards one at a time and slide
 * through them. `onEdit`/`onAdd` are for your own profile.
 */
export function ThingsStack({
  things,
  title,
  onEdit,
  onAdd,
  addLabel,
}: {
  things: Thing[];
  title: string;
  /** Your own cards: change one from the viewer */
  onEdit?: (i: number) => void;
  /** Your own cards: add another */
  onAdd?: () => void;
  addLabel?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const n = things.length;
  if (n === 0) return null;
  const top = things[0];
  const behind = Math.min(2, n - 1);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          setOpen(0);
        }}
        className="group relative mx-auto block w-full max-w-[280px] pt-8 pb-3 transition active:scale-[0.98]"
        aria-label={`${title}: ${n} cards. Tap to open`}
      >
        <div className="relative w-full">
          {/* The cards underneath, fanned out */}
          {behind >= 2 && (
            <div
              aria-hidden
              className="absolute inset-0 origin-bottom translate-x-3 -translate-y-2 rotate-[7deg] overflow-hidden rounded-[26px] opacity-80 shadow-card transition group-hover:rotate-[9deg]"
            >
              <CardFace thing={things[2]} />
            </div>
          )}
          {behind >= 1 && (
            <div
              aria-hidden
              className="absolute inset-0 origin-bottom -translate-x-2 -translate-y-1 -rotate-[5deg] overflow-hidden rounded-[26px] opacity-90 shadow-card transition group-hover:-rotate-[7deg]"
            >
              <CardFace thing={things[1]} />
            </div>
          )}
          <div className="relative overflow-hidden rounded-[26px] shadow-[0_18px_40px_-18px_rgba(28,24,40,0.55)]">
            <CardFace thing={top} />
          </div>
          <span className="absolute -top-2 -right-2 grid h-9 min-w-9 place-items-center rounded-full bg-ink px-2 text-[14px] font-bold text-white ring-4 ring-surface">
            {n}
          </span>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand">
          <Hand size={15} /> Tap to flip through {n === 1 ? "it" : `all ${n}`}
        </span>
      </button>

      {open !== null && (
        <ThingsViewer
          things={things}
          start={open}
          title={title}
          onClose={() => setOpen(null)}
          onEdit={
            onEdit &&
            ((i) => {
              setOpen(null);
              onEdit(i);
            })
          }
          onAdd={
            onAdd &&
            (() => {
              setOpen(null);
              onAdd();
            })
          }
          addLabel={addLabel}
        />
      )}
    </>
  );
}

/** The cards one at a time, big. Slide (or tap a side) to go through them. */
export function ThingsViewer({
  things,
  start,
  title,
  onClose,
  onEdit,
  onAdd,
  addLabel,
}: {
  things: Thing[];
  start: number;
  title: string;
  onClose: () => void;
  onEdit?: (i: number) => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const n = things.length;
  const [idx, setIdx] = useState(Math.min(start, n - 1));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Card flying off after a slide: which way
  const [fly, setFly] = useState<0 | 1 | -1>(0);
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    id: number;
  } | null>(null);
  const width = useRef(360);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const to = idx + dir;
    if (to < 0 || to >= n || fly) return;
    tapFeedback();
    setFly(dir);
    setDx(-dir * (width.current + 80));
    setTimeout(() => {
      setFly(0);
      setDx(0);
      setIdx(to);
    }, 220);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Dragging past the first or last card gives a little, then springs back
  const atEdge = (dx > 0 && idx === 0) || (dx < 0 && idx === n - 1);
  const shown = dragging && atEdge ? dx * 0.25 : dx;
  const progress = Math.min(1, Math.abs(shown) / 220);
  // The card underneath: the next one when sliding left, the one before when sliding right
  const underIdx = shown > 0 ? idx - 1 : idx + 1;
  const under = underIdx >= 0 && underIdx < n ? things[underIdx] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-ink/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {title}
          </p>
          <p className="text-[13px] text-white/60">
            {idx + 1} of {n}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress: one bar per card */}
      <div className="mx-auto mt-3 flex w-full max-w-md gap-1 px-4" aria-hidden>
        {things.map((_, i) => (
          <span
            key={i}
            className={clsx(
              "h-1 flex-1 rounded-full transition-colors",
              i <= idx ? "bg-white" : "bg-white/25",
            )}
          />
        ))}
      </div>

      {/* A very long card scrolls up and down here; nothing is ever hidden */}
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-contain no-scrollbar">
        <div className="m-auto w-full px-6 py-6">
          <div className="relative mx-auto w-full max-w-[340px]">
            {under && (
              <div
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-[32px] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)]"
                style={{
                  transform: `scale(${0.9 + 0.1 * progress}) translateY(${(1 - progress) * 14}px)`,
                  opacity: 0.5 + 0.5 * progress,
                  transition: dragging
                    ? "none"
                    : "transform 220ms ease, opacity 220ms ease",
                }}
              >
                <CardFace thing={under} big />
              </div>
            )}
            <div
              key={idx}
              ref={card}
              className={clsx(
                "relative cursor-grab touch-pan-y overflow-hidden rounded-[32px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] select-none active:cursor-grabbing",
                !fly && !dragging && dx === 0 && "animate-pop",
              )}
              style={{
                transform: `translateX(${shown}px) rotate(${shown / 18}deg)`,
                transition: dragging
                  ? "none"
                  : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
              onPointerDown={(e) => {
                if (fly) return;
                width.current = card.current?.offsetWidth ?? 360;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  moved: false,
                  id: e.pointerId,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(true);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                const mx = e.clientX - d.x;
                if (Math.abs(mx) > 6) d.moved = true;
                setDx(mx);
              }}
              onPointerUp={(e) => {
                const d = drag.current;
                drag.current = null;
                setDragging(false);
                if (!d) return;
                const mx = e.clientX - d.x;
                // A tap: right side goes on, left side goes back (like stories)
                if (!d.moved) {
                  setDx(0);
                  const r = e.currentTarget.getBoundingClientRect();
                  go(e.clientX - r.left > r.width * 0.35 ? 1 : -1);
                  return;
                }
                const dir = mx < 0 ? 1 : -1;
                if (Math.abs(mx) > 70 && idx + dir >= 0 && idx + dir < n)
                  go(dir);
                else setDx(0);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragging(false);
                setDx(0);
              }}
            >
              <CardFace thing={things[idx]} big />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md items-center gap-2.5 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={idx === 0}
          aria-label="Card before"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-white transition active:scale-95 disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-1 justify-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(idx)}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-[14px] font-semibold text-white active:scale-95"
            >
              <Pencil size={16} /> Edit
            </button>
          )}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-ink active:scale-95"
            >
              <Plus size={17} /> {addLabel ?? "Add"}
            </button>
          )}
          {!onEdit && !onAdd && (
            <p className="self-center text-[13px] text-white/60">
              Slide or tap to see more
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => (idx === n - 1 ? onClose() : go(1))}
          aria-label={idx === n - 1 ? "Done" : "Next card"}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-ink transition active:scale-95"
        >
          {idx === n - 1 ? <X size={20} /> : <ChevronRight size={22} />}
        </button>
      </div>
    </div>,
    document.body,
  );
}
