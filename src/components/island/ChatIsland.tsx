"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Download, Info, Maximize, Minus, Plus, RotateCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { layoutIsland, skyNow, type IslandData, type IslandLayout } from "@/lib/island";
import { IslandArt, islandExtent, type IslandView } from "./IslandArt";

const INTRO_KEY = "dp_island_intro_v1";
type Sky = "day" | "sunset" | "night";

// A small island for the guide
const SAMPLE: IslandData = {
  total: 26,
  since: null,
  unmasked: false,
  names: null,
  items: [
    ["text", "hi stranger"], ["text", "dinner tonight?"], ["text", "beach this weekend"], ["text", "work is stressing me"], ["text", "this song is a vibe"],
    ["text", "home now"], ["text", "coffee date?"], ["text", "football tonight"], ["text", "traffic is wild"], ["text", "love that"], ["text", "ok"], ["text", "lol"],
  ],
};

/**
 * Your Island (beta) for one chat. It opens from + → More. The first time someone opens a chat on
 * this phone, a short guide explains it.
 */
export function ChatIsland({
  session,
  match,
  open,
  onOpen,
  onClose,
  refresh,
  demo,
  noIntro,
  forceSky,
}: {
  session?: string | null;
  match?: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Changes when a message is sent or arrives, so an open island updates */
  refresh: number;
  demo?: IslandData;
  /** Design previews: don't show the guide */
  noIntro?: boolean;
  /** Design previews: a set time of day */
  forceSky?: Sky;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<IslandData | null>(demo ?? null);
  const [intro, setIntro] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Day, sunset or night from this phone's clock (worked out in the browser, not on the server)
  const [sky, setSky] = useState<Sky>("day");

  useEffect(() => {
    setMounted(true);
    setSky(forceSky ?? skyNow());
    if (noIntro) return;
    let seen = true;
    try {
      seen = localStorage.getItem(INTRO_KEY) === "1";
    } catch {
      /* private mode */
    }
    if (seen) return;
    const t = setTimeout(() => setIntro(true), 900);
    return () => clearTimeout(t);
  }, [noIntro, forceSky]);

  function closeIntro() {
    setIntro(false);
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode */
    }
  }

  // Load the island when it's opened, and again shortly after each new message while it's open
  useEffect(() => {
    if (demo || !open || (!session && !match)) return;
    let live = true;
    const t = setTimeout(() => {
      supabase.rpc("chat_island", { p_session: session ?? null, p_match: match ?? null }).then(({ data: d }) => {
        if (live && d) setData(d as IslandData);
      });
    }, data ? 800 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, session, match, refresh, demo, open]);

  if (!mounted) return null;
  return (
    <>
      <IslandIntro
        open={intro}
        sky={sky}
        onClose={closeIntro}
        onSee={() => {
          closeIntro();
          onOpen();
        }}
      />
      {open && <IslandWorld data={data} sky={sky} onClose={onClose} />}
    </>
  );
}

/** The guide shown the first time: what it is and where to find it */
function IslandIntro({ open, sky, onClose, onSee }: { open: boolean; sky: Sky; onClose: () => void; onSee: () => void }) {
  const layout = useMemo(() => layoutIsland(SAMPLE), []);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New: Your Island"
      subtitle="Every chat grows its own little island"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            Later
          </Button>
          <Button size="lg" onClick={onSee} className="flex-[2]">
            See our island
          </Button>
        </div>
      }
    >
      <div className="relative h-40 overflow-hidden rounded-3xl bg-[#3cc4d9]">
        <IslandArt layout={layout} sky={sky} view={fitView(layout, 350, 160, 0)} width={350} height={160} className="block h-full w-full" />
        <span className="absolute top-2.5 left-2.5 rounded-full bg-gold px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-ink uppercase">Beta</span>
      </div>
      <HowItWorks compact />
    </Sheet>
  );
}

/** How Your Island works (the guide, and the ⓘ on the island) */
function HowItWorks({ compact }: { compact?: boolean }) {
  const rows: [string, string][] = [
    ["Every message builds something", `"dinner" builds a food stall, "football" a pitch, "work" an office, "party" a stage, "coffee" a café, "traffic" a danfo. Voice notes bring birds.`],
    ["It levels up as you talk", "Keep chatting and a cottage becomes a two-storey house, then a block of flats. A stall becomes a Mama Put, then a busy restaurant."],
    ["The land keeps growing", "Every building gets its own plot between proper roads, and the island gets bigger as you chat. Every 60 messages a footbridge goes up over a road. A boat arrives at 20 messages, a lighthouse at 100."],
    ["Explore it", "Pinch to zoom in, drag to move around, and turn it with the rotate button. Tap any building to see the message that made it."],
    ["Fog clears as you get to know each other", "Masked chats start in fog. Unmask together and the sun comes out, with your names on a signpost."],
  ];
  const shown = compact ? rows : [...rows, ["Just for you two", "You both see the same island, and only you two can see it. Tap any piece to see the message that made it."] as [string, string]];
  return (
    <div className="mt-4 space-y-3">
      {shown.map(([t, d], i) => (
        <div key={t} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-ink">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold">{t}</p>
            <p className="text-[13px] leading-snug text-muted">{d}</p>
          </div>
        </div>
      ))}
      <p className="rounded-2xl bg-cream px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-soft">
        <b className="font-semibold">Beta:</b> we&apos;re still building it. Find it any time in <b className="font-semibold">+ → Your Island</b>.
      </p>
    </div>
  );
}

/** Fit the whole island on a screen of this size */
function fitView(layout: IslandLayout, w: number, h: number, room = 270): IslandView {
  const { halfW, halfH } = islandExtent(layout);
  // Room above the island for tall buildings, and for the buttons and cards on the screen
  const top = room ? 70 : 0;
  const s = Math.min((w - 16) / (halfW * 2.05), (h - room) / (halfH * 2.2 + 70), 2.2);
  return { x: w / 2, y: top + (h - room) / 2 + 30 * s, s };
}

/**
 * The island, full screen. Drag to move around, pinch (or the buttons) to zoom, turn it with the
 * rotate button, and tap a building to see the message that made it.
 */
function IslandWorld({ data, sky, onClose }: { data: IslandData | null; sky: Sky; onClose: () => void }) {
  const layout = useMemo(() => (data ? layoutIsland(data) : null), [data]);
  const [picked, setPicked] = useState<number | null>(null);
  const [how, setHow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rot, setRot] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<IslandView | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Gestures: the live view while a finger moves (drawn straight onto the picture, saved when it stops)
  const live = useRef<IslandView | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: IslandView } | null>(null);
  const moved = useRef(false);
  const fit = useRef<IslandView | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // The screen size, and the whole island fitted to it to start with
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!layout || !size) return;
    const f = fitView(layout, size.w, size.h);
    fit.current = f;
    // Start a little closer in (the whole island is one tap away on the ⛶ button)
    const k = layout.radius > 5 ? 1.45 : 1.15;
    setView((v) => v ?? { s: f.s * k, x: size.w / 2 - (size.w / 2 - f.x) * k, y: size.h * 0.46 - (size.h * 0.46 - f.y) * k });
  }, [layout, size]);

  const apply = (v: IslandView) => {
    live.current = v;
    world.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.s})`);
  };
  const clampS = (s: number) => Math.max((fit.current?.s ?? 0.3) * 0.6, Math.min(4, s));
  const zoomAt = (v: IslandView, k: number, at: { x: number; y: number }): IslandView => {
    const s = clampS(v.s * k);
    const r = s / v.s;
    return { s, x: at.x - (at.x - v.x) * r, y: at.y - (at.y - v.y) * r };
  };
  const commit = () => {
    if (live.current) setView(live.current);
  };

  function down(e: React.PointerEvent) {
    // (No pointer capture: it would swallow taps on buildings. The island fills the screen anyway.)
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 1) moved.current = false;
    live.current = live.current ?? view;
    if (fingers.current.size === 2) {
      const [a, b] = Array.from(fingers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: live.current ?? view! };
    }
  }
  function move(e: React.PointerEvent) {
    const last = fingers.current.get(e.pointerId);
    if (!last || !live.current) return;
    const now = { x: e.clientX, y: e.clientY };
    fingers.current.set(e.pointerId, now);
    if (fingers.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(fingers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const p = pinch.current;
      const z = zoomAt(p.view, dist / p.dist, p.mid);
      apply({ ...z, x: z.x + (mid.x - p.mid.x), y: z.y + (mid.y - p.mid.y) });
      moved.current = true;
      return;
    }
    const dx = now.x - last.x;
    const dy = now.y - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      if (Math.abs(now.x - last.x) + Math.abs(now.y - last.y) > 2) moved.current = true;
      apply({ ...live.current, x: live.current.x + dx, y: live.current.y + dy });
    }
  }
  function up(e: React.PointerEvent) {
    fingers.current.delete(e.pointerId);
    if (fingers.current.size < 2) pinch.current = null;
    if (fingers.current.size === 0) commit();
  }
  function wheel(e: React.WheelEvent) {
    const v = live.current ?? view;
    if (!v) return;
    const z = zoomAt(v, e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX, y: e.clientY });
    apply(z);
    commit();
  }
  function zoomButton(k: number) {
    tapFeedback();
    const v = live.current ?? view;
    if (!v || !size) return;
    const z = zoomAt(v, k, { x: size.w / 2, y: size.h / 2 });
    apply(z);
    setView(z);
  }
  function recentre() {
    tapFeedback();
    if (!fit.current) return;
    live.current = fit.current;
    setView(fit.current);
  }

  async function save() {
    const el = svg.current;
    if (!el || saving || !size) return;
    tapFeedback();
    setSaving(true);
    try {
      const xml = new XMLSerializer().serializeToString(el);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("load"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size.w * 2;
      canvas.height = size.h * 2;
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], "our-island.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Our island on Dashpad" }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "our-island.png";
        a.click();
      }
    } catch {
      /* couldn't make the picture */
    } finally {
      setSaving(false);
    }
  }

  const piece = picked != null && layout ? layout.pieces[picked] ?? null : null;
  const fogLeft = layout ? Math.round((layout.fog / 0.9) * 100) : 100;
  const next = !layout
    ? null
    : !layout.boat
      ? "a boat at 20 messages"
      : layout.total < 100
        ? "a lighthouse at 100 messages"
        : `another footbridge at ${(Math.floor(layout.total / 60) + 1) * 60} messages`;

  return createPortal(
    <div className="fixed inset-0 z-[85] bg-[#136a9c] animate-fade-in" role="dialog" aria-modal="true" aria-label="Your island">
      <div
        ref={box}
        className="absolute inset-0 touch-none select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onClick={() => {
          if (!moved.current) setPicked(null);
        }}
      >
        {layout && size && view ? (
          <IslandArt
            ref={svg}
            worldRef={world}
            layout={layout}
            sky={sky}
            names={data?.names}
            picked={picked}
            onPick={(i) => {
              if (!moved.current) setPicked(i);
            }}
            rot={rot}
            view={view}
            width={size.w}
            height={size.h}
            className="block"
          />
        ) : (
          <div className="grid h-full place-items-center text-[14px] font-semibold text-white/80">Loading your island…</div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-md items-center gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Back to chat" className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 text-ink">
          <ChevronLeft size={20} />
        </button>
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-bold">
          Your Island
          <span className="rounded-full bg-gold px-1.5 py-px text-[10px] font-extrabold tracking-wide uppercase">Beta</span>
          {layout && <span className="font-semibold text-muted">· day {layout.days}</span>}
        </span>
        <button type="button" onClick={() => setHow(true)} aria-label="How Your Island works" className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 text-ink">
          <Info size={18} />
        </button>
        <button type="button" onClick={save} disabled={saving || !layout} aria-label="Save a picture of your island" className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 text-ink disabled:opacity-60">
          <Download size={18} />
        </button>
      </div>

      {/* Zoom, turn and fit */}
      {layout && (
        <div className="pointer-events-none absolute top-[max(74px,calc(env(safe-area-inset-top)+64px))] right-3 flex flex-col gap-2">
          <MapButton label="Zoom in" onClick={() => zoomButton(1.35)}><Plus size={19} /></MapButton>
          <MapButton label="Zoom out" onClick={() => zoomButton(1 / 1.35)}><Minus size={19} /></MapButton>
          <MapButton label="Turn the island" onClick={() => { tapFeedback(); setRot((r) => (r + 1) % 4); }}><RotateCw size={18} /></MapButton>
          <MapButton label="See the whole island" onClick={recentre}><Maximize size={17} /></MapButton>
        </div>
      )}

      {layout && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-2 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          {piece ? (
            <div className="rounded-2xl bg-ink/90 px-4 py-3 text-white">
              <p className="text-[12px] font-semibold text-white/70">
                {piece.label.charAt(0).toUpperCase() + piece.label.slice(1)}
                {piece.level > 1 ? ` (level ${piece.level})` : ""} came from
              </p>
              <p className="mt-0.5 line-clamp-3 text-[14px] leading-snug">{piece.from ? `"${piece.from}"` : "a message"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Stat value={data?.unmasked ? "Clear" : `${100 - fogLeft}%`} label={data?.unmasked ? "you unmasked" : "fog cleared"} />
              <Stat value={String(layout.pieceCount)} label={layout.pieceCount === 1 ? "building" : "buildings"} />
              <Stat value={String(layout.footbridges.length)} label={layout.footbridges.length === 1 ? "footbridge" : "footbridges"} />
            </div>
          )}
          <p className="rounded-2xl bg-ink/80 px-4 py-2.5 text-[12.5px] leading-snug text-white">
            {next ? `Next: ${next}. ` : ""}Pinch to zoom, drag to explore, tap a building to see what made it.
          </p>
        </div>
      )}

      {how && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={() => setHow(false)}>
          <div className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[18px] font-semibold">
                How Your Island works
                <span className="rounded-full bg-gold px-1.5 py-px text-[10px] font-extrabold tracking-wide uppercase">Beta</span>
              </p>
              <button type="button" onClick={() => setHow(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-ink/[0.06]">
                <X size={18} />
              </button>
            </div>
            <HowItWorks />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/92 text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)] transition active:scale-95"
    >
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/95 px-2 py-2.5 text-center">
      <p className="text-[17px] leading-tight font-extrabold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
