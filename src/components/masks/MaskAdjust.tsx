"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";
import { lockScroll } from "@/lib/scrollLock";
import { NO_ADJ, clampAdj, finalSpot, placeMask } from "@/lib/maskPlace";
import type { MaskAdj, PhotoMask } from "@/lib/types";
import { MaskedPreview } from "./MaskedPreview";

type Masked = Exclude<PhotoMask, { none: true }>;
type Pt = { x: number; y: number };

/**
 * Moving, resizing and turning a photo's mask, full screen. One finger drags it; two fingers pinch
 * to resize and twist to turn. With a mouse: drag, scroll to resize, Shift + scroll to turn.
 * Buttons do the same in small steps. In a photo with several faces, tap a mask to pick it.
 */
export function MaskAdjust({ src, mask, onChange, onDone }: { src: string; mask: Masked; onChange: (m: Masked) => void; onDone: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => lockScroll(), []);

  // The photo's shape (for converting finger movement into the photo's own units)
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => i.naturalWidth && setRatio(i.naturalWidth / i.naturalHeight);
    i.src = src;
  }, [src]);

  const [sel, setSel] = useState(0);
  const latest = useRef(mask);
  latest.current = mask;
  const selRef = useRef(sel);
  selRef.current = sel;

  const box = useRef<HTMLDivElement>(null);
  const ptrs = useRef(new Map<number, Pt>());
  const start = useRef<{ adj: MaskAdj; pts: Pt[] } | null>(null);

  const adjOf = (k: number) => latest.current.faces[k]?.adj ?? NO_ADJ;

  /** Change one face's adjustment (kept within the limits) */
  function setAdj(k: number, a: MaskAdj) {
    if (!ratio) return;
    const m = latest.current;
    const face = m.faces[k];
    if (!face) return;
    const base = placeMask(m.mask, face);
    const next = clampAdj(m.mask, base, a, ratio);
    onChange({ ...m, faces: m.faces.map((f, j) => (j === k ? { ...f, adj: next } : f)) });
  }

  /** Remember where the fingers started, and the mask, so each move is measured from there */
  function begin() {
    start.current = { adj: adjOf(selRef.current), pts: [...ptrs.current.values()].slice(0, 2) };
  }

  const local = (e: React.PointerEvent | React.WheelEvent): Pt => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    if (!ratio || !box.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    // First finger: pick the mask nearest to it
    if (ptrs.current.size === 1 && latest.current.faces.length > 1) {
      const r = box.current.getBoundingClientRect();
      const fx = p.x / r.width;
      const fy = p.y / r.height;
      let best = selRef.current;
      let bestD = Infinity;
      latest.current.faces.forEach((f, k) => {
        const s = finalSpot(latest.current.mask, f, ratio);
        const d = Math.hypot(s.cx - fx, (s.cy - fy) / ratio);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      if (best !== selRef.current) {
        selRef.current = best;
        setSel(best);
        tapFeedback();
      }
    }
    begin();
  }

  function move(e: React.PointerEvent) {
    if (!ptrs.current.has(e.pointerId) || !start.current || !box.current) return;
    ptrs.current.set(e.pointerId, local(e));
    const r = box.current.getBoundingClientRect();
    const now = [...ptrs.current.values()].slice(0, 2);
    const a0 = start.current.adj;
    const p0 = start.current.pts;
    if (now.length === 1 && p0.length === 1) {
      setAdj(selRef.current, { ...a0, x: a0.x + (now[0].x - p0[0].x) / r.width, y: a0.y + (now[0].y - p0[0].y) / r.height });
    } else if (now.length >= 2 && p0.length >= 2) {
      const mid = (q: Pt[]) => ({ x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 });
      const dist = (q: Pt[]) => Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) || 1;
      const ang = (q: Pt[]) => (Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x) * 180) / Math.PI;
      let turn = ang(now) - ang(p0);
      if (turn > 180) turn -= 360;
      if (turn < -180) turn += 360;
      const m0 = mid(p0);
      const m1 = mid(now);
      setAdj(selRef.current, {
        x: a0.x + (m1.x - m0.x) / r.width,
        y: a0.y + (m1.y - m0.y) / r.height,
        k: a0.k * (dist(now) / dist(p0)),
        r: a0.r + turn,
      });
    }
  }

  function up(e: React.PointerEvent) {
    ptrs.current.delete(e.pointerId);
    // A finger lifted: carry on from here with the ones still down (so nothing jumps)
    if (ptrs.current.size) begin();
    else start.current = null;
  }

  // Mouse wheel: resize (Shift: turn). Not passive, so the page doesn't scroll instead
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const a = adjOf(selRef.current);
      if (e.shiftKey) setAdj(selRef.current, { ...a, r: a.r + Math.sign(e.deltaY || e.deltaX) * 3 });
      else setAdj(selRef.current, { ...a, k: a.k * Math.exp(-e.deltaY * 0.0015) });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  const step = (fn: (a: MaskAdj) => MaskAdj) => {
    tapFeedback();
    setAdj(sel, fn(adjOf(sel)));
  };

  // The chosen mask, ringed (only needed when there's more than one)
  const ring = ratio && mask.faces.length > 1 && mask.faces[sel] ? finalSpot(mask.mask, mask.faces[sel], ratio) : null;
  const changed = mask.faces.some((f) => f.adj && (f.adj.x || f.adj.y || f.adj.k !== 1 || f.adj.r));

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0d0a14] text-white animate-fade-in" role="dialog" aria-modal="true" aria-label="Move, resize or turn your mask">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onChange({ ...latest.current, faces: latest.current.faces.map((f) => ({ ...f, adj: undefined })) });
          }}
          disabled={!changed}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/12 px-3.5 text-[14px] font-bold disabled:opacity-40"
        >
          <Undo2 size={16} /> Reset
        </button>
        <p className="min-w-0 flex-1 text-center text-[15px] font-bold">Move & resize</p>
        <button type="button" onClick={onDone} className="h-10 rounded-full bg-gold px-5 text-[15px] font-extrabold text-ink">
          Done
        </button>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center px-4">
        {ratio && (
          <div
            ref={box}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="relative cursor-grab touch-none select-none active:cursor-grabbing"
            style={{ width: `min(calc(100vw - 32px), calc((100dvh - 250px) * ${ratio}), 560px)` }}
          >
            <MaskedPreview src={src} mask={mask} natural className="w-full rounded-[20px] bg-black/40" />
            {ring && (
              <span
                aria-hidden
                className="pointer-events-none absolute rounded-full border-2 border-dashed border-gold"
                style={{
                  left: `${ring.cx * 100}%`,
                  top: `${ring.cy * 100}%`,
                  width: `${ring.s * 150 * 100}%`,
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-[max(18px,env(safe-area-inset-bottom))]">
        <p className="text-center text-[13.5px] text-white/75">
          Drag to move · pinch to resize · twist to turn
          {mask.faces.length > 1 ? " · tap a mask to pick it" : ""}
        </p>
        <div className="mx-auto mt-3 grid max-w-sm grid-cols-4 gap-2">
          <Ctrl label="Smaller" onClick={() => step((a) => ({ ...a, k: a.k / 1.06 }))}>
            <Minus size={20} />
          </Ctrl>
          <Ctrl label="Bigger" onClick={() => step((a) => ({ ...a, k: a.k * 1.06 }))}>
            <Plus size={20} />
          </Ctrl>
          <Ctrl label="Turn left" onClick={() => step((a) => ({ ...a, r: a.r - 4 }))}>
            <RotateCcw size={19} />
          </Ctrl>
          <Ctrl label="Turn right" onClick={() => step((a) => ({ ...a, r: a.r + 4 }))}>
            <RotateCw size={19} />
          </Ctrl>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Ctrl({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-12 place-items-center rounded-2xl bg-white/12 active:scale-95 active:bg-white/20">
      {children}
    </button>
  );
}
