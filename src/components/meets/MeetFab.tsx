"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";

const KEY = "dp-meet-fab";
const SIZE = 60;
const EDGE = 16;

type Spot = { side: "left" | "right"; /** distance from the bottom of the screen, as a share of its height */ up: number };

function readSpot(): Spot {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "") as Spot;
    if ((s.side === "left" || s.side === "right") && typeof s.up === "number") return s;
  } catch {}
  return { side: "right", up: 0 };
}

const desktop = () => window.matchMedia("(min-width: 1024px)").matches;

/** Room taken at the bottom by the phone menu (none on computers) */
function bottomGap() {
  return desktop() ? EDGE + 8 : 64 + EDGE;
}

/** Room taken on the left by the side menu on computers */
function leftGap() {
  if (!desktop()) return 0;
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w"), 10) || 0;
}

/**
 * The floating "post a meet" button on Home. Drag it anywhere: it sticks to the
 * nearest side and stays where you left it. Tap it to post.
 */
export function MeetFab({ free, onOpen }: { free: boolean; onOpen: () => void }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  const [, setSize] = useState(0);

  useEffect(() => {
    setSpot(readSpot());
    const onResize = () => setSize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (!spot) return null;

  function place(s: Spot) {
    const h = window.innerHeight;
    const min = bottomGap();
    const max = h - SIZE - 90;
    const bottom = Math.min(max, Math.max(min, min + s.up * h));
    return { bottom, x: s.side === "left" ? leftGap() + EDGE : window.innerWidth - SIZE - EDGE };
  }

  const pos = typeof window === "undefined" ? null : place(spot);

  return (
    <button
      ref={btn}
      type="button"
      aria-label="Post a meet. Drag to move it."
      title="Post a meet"
      onPointerDown={(e) => {
        const r = btn.current!.getBoundingClientRect();
        btn.current!.setPointerCapture(e.pointerId);
        start.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, moved: false };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const dx = e.clientX - s.px;
        const dy = e.clientY - s.py;
        if (!s.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        s.moved = true;
        setDrag({
          x: Math.min(window.innerWidth - SIZE - 4, Math.max(4, s.x + dx)),
          y: Math.min(window.innerHeight - SIZE - 4, Math.max(4, s.y + dy)),
        });
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        if (!s.moved) {
          tapFeedback();
          onOpen();
          return;
        }
        const x = drag?.x ?? s.x;
        const y = drag?.y ?? s.y;
        const h = window.innerHeight;
        const next: Spot = {
          side: x + SIZE / 2 < (leftGap() + window.innerWidth) / 2 ? "left" : "right",
          up: (h - y - SIZE - bottomGap()) / h,
        };
        setDrag(null);
        setSpot(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        e.preventDefault();
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        "fixed z-40 grid touch-none place-items-center rounded-full text-white select-none",
        "bg-[linear-gradient(140deg,#6d4ff0,#4730b3)] shadow-[0_4px_0_#2b1d73,0_12px_28px_-6px_rgb(91_63_217/0.7)]",
        drag ? "cursor-grabbing" : "cursor-grab transition-[left,bottom,top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95",
      )}
      style={
        drag
          ? { width: SIZE, height: SIZE, left: drag.x, top: drag.y }
          : { width: SIZE, height: SIZE, left: pos?.x, bottom: `calc(${pos?.bottom ?? 0}px + env(safe-area-inset-bottom))` }
      }
    >
      <Plus size={28} strokeWidth={2.4} />
      {free && (
        <span className="absolute -top-1 -right-1.5 rounded-full bg-mint px-1.5 py-[3px] text-[10px] leading-none font-extrabold text-white ring-2 ring-cream">
          FREE
        </span>
      )}
    </button>
  );
}
