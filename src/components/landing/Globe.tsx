"use client";

import { useEffect, useRef, useState } from "react";
import createGlobe, { type Arc, type Marker } from "cobe";
import { MaskIcon } from "@/components/ui/MaskIcon";

// Dashpad colours, as 0–1 RGB for the globe
const BRAND: [number, number, number] = [0.357, 0.247, 0.851];
const GOLD: [number, number, number] = [0.95, 0.7, 0.24];
const ROSE: [number, number, number] = [0.76, 0.19, 0.42];

const CITIES: Record<string, [number, number]> = {
  lagos: [6.52, 3.38],
  abuja: [9.08, 7.4],
  accra: [5.6, -0.19],
  nairobi: [-1.29, 36.82],
  joburg: [-26.2, 28.05],
  cairo: [30.04, 31.24],
  kigali: [-1.95, 30.06],
  london: [51.5, -0.12],
  newyork: [40.71, -74.0],
  toronto: [43.65, -79.38],
  dubai: [25.2, 55.27],
  paris: [48.86, 2.35],
};

const MARKERS: Marker[] = Object.entries(CITIES).map(([id, location], i) => ({
  location,
  size: id === "lagos" ? 0.09 : i % 3 === 0 ? 0.06 : 0.045,
  color: i % 3 === 1 ? ROSE : i % 3 === 2 ? BRAND : GOLD,
}));

const ARCS: Arc[] = [
  ["lagos", "london"],
  ["lagos", "accra"],
  ["lagos", "nairobi"],
  ["accra", "newyork"],
  ["nairobi", "dubai"],
  ["lagos", "joburg"],
  ["abuja", "cairo"],
  ["london", "toronto"],
].map(([a, b], i) => ({ from: CITIES[a], to: CITIES[b], color: i % 2 ? ROSE : BRAND }));

// Face Africa first (cobe’s own formula for turning to a longitude)
const START_PHI = Math.PI - ((3.38 * Math.PI) / 180 - Math.PI / 2);

/** People connecting across the world. */
const PEOPLE = [
  { name: "Velvet Owl", where: "Lagos", color: "#5b3fd9", pos: "left-[2%] top-[14%]", delay: "0s" },
  { name: "Golden Fox", where: "Accra", color: "#c2306b", pos: "right-[0%] top-[34%]", delay: "1.2s" },
  { name: "Quiet Heron", where: "London", color: "#c06f12", pos: "left-[6%] bottom-[14%]", delay: "2.1s" },
];

/** A slowly spinning Earth with glowing cities and the links between them. You can drag it. */
export function Globe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ x: number; phi: number } | null>(null);
  const spin = useRef({ phi: START_PHI, extra: 0 });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = el.offsetWidth;
    let globe: ReturnType<typeof createGlobe> | null = null;
    try {
      globe = createGlobe(el, {
        devicePixelRatio: dpr,
        width: width * dpr,
        height: width * dpr,
        phi: START_PHI,
        theta: 0.28,
        dark: 0,
        diffuse: 1.4,
        mapSamples: 16000,
        mapBrightness: 5.5,
        mapBaseBrightness: 0.04,
        baseColor: [1, 1, 1],
        markerColor: GOLD,
        glowColor: [0.93, 0.9, 1],
        markers: MARKERS,
        arcs: ARCS,
        arcColor: BRAND,
        arcWidth: 0.6,
        arcHeight: 0.25,
        markerElevation: 0.01,
        opacity: 0.95,
      });
    } catch {
      return; // No WebGL: the soft circle behind stays as a fallback
    }
    setReady(true);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const ro = new ResizeObserver(() => {
      width = el.offsetWidth;
      globe?.update({ width: width * dpr, height: width * dpr });
    });
    ro.observe(el);

    let raf = 0;
    const tick = () => {
      if (visible && document.visibilityState === "visible") {
        if (!drag.current && !still) spin.current.phi += 0.0032;
        globe?.update({ phi: spin.current.phi + spin.current.extra });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      globe?.destroy();
    };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, phi: spin.current.extra };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    spin.current.extra = drag.current.phi + (e.clientX - drag.current.x) / 160;
  };
  const onUp = () => (drag.current = null);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      {/* Soft glow behind the Earth (also what shows if the globe can’t load) */}
      <div aria-hidden className="absolute inset-[8%] rounded-full bg-gradient-to-br from-brand/15 via-[#f3e8ff] to-gold/20 blur-2xl" />
      <canvas
        ref={canvas}
        aria-label="A spinning Earth with people connecting across Africa and the world"
        role="img"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={
          "relative h-full w-full cursor-grab touch-pan-y transition-opacity duration-1000 active:cursor-grabbing " + (ready ? "opacity-100" : "opacity-0")
        }
      />
      {PEOPLE.map((p) => (
        <span
          key={p.name}
          className={"pointer-events-none absolute animate-float " + p.pos}
          style={{ animationDelay: p.delay }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 py-1.5 pr-3.5 pl-1.5 shadow-lift backdrop-blur">
            <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: p.color }}>
              <MaskIcon className="w-5 text-white" eyes={p.color} />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-semibold text-ink">{p.name}</span>
              <span className="block text-[11px] text-muted">{p.where}</span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
