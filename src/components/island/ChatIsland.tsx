"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronUp, Download, TreePalm } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapFeedback } from "@/components/ui/Button";
import { layoutIsland, pieceLine, skyNow, type IslandData } from "@/lib/island";
import { IslandArt } from "./IslandArt";

const OPEN_KEY = "dp_island_open";

/**
 * Your Island at the top of a chat: it grows with every message you two send. Tap it to see the
 * whole island; the arrow folds it away (remembered on this phone).
 */
export function ChatIsland({
  session,
  match,
  refresh,
  latest,
  demo,
  startFull,
}: {
  session?: string | null;
  match?: string | null;
  /** Changes when a message is sent or arrives (the number of messages), so the island updates */
  refresh: number;
  /** The newest message, to say what it built */
  latest?: { id?: number | string; kind?: string | null; body: string } | null;
  demo?: IslandData;
  /** Design previews: open the full island straight away */
  startFull?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<IslandData | null>(demo ?? null);
  const [open, setOpen] = useState(true);
  const [full, setFull] = useState(!!startFull);
  const [toast, setToast] = useState<string | null>(null);
  const first = useRef(true);
  // The full view opens over the whole page, so only once the page is in the browser
  const [mounted, setMounted] = useState(false);
  // Day, sunset or night from this phone's clock (worked out in the browser, not on the server)
  const [sky, setSky] = useState<"day" | "sunset" | "night">("day");
  useEffect(() => {
    setMounted(true);
    setSky(skyNow());
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
    } catch {
      /* private mode */
    }
  }, []);

  // Load the island, and again shortly after each new message
  useEffect(() => {
    if (demo || (!session && !match)) return;
    let live = true;
    const t = setTimeout(
      () => {
        supabase.rpc("chat_island", { p_session: session ?? null, p_match: match ?? null }).then(({ data: d }) => {
          if (live && d) setData(d as IslandData);
        });
      },
      first.current ? 0 : 1200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [supabase, session, match, refresh, demo]);

  // A new message: say what it built (not when older messages load further up)
  const lastId = useRef(latest?.id);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!latest || latest.kind === "system" || latest.id === lastId.current) return;
    lastId.current = latest.id;
    setToast(pieceLine(latest.kind ?? "text", latest.body ?? ""));
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const layout = useMemo(() => (data ? layoutIsland(data) : null), [data]);
  if (!layout || !data) return null;

  function toggle() {
    tapFeedback();
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  return (
    <>
      {open ? (
        <div className="relative mx-3 mt-2 h-[132px] shrink-0 overflow-hidden rounded-[20px] bg-[#3e9fc4] shadow-[0_10px_24px_-16px_rgba(28,24,40,0.6)] lg:mx-auto lg:w-full lg:max-w-xl">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setFull(true);
            }}
            className="absolute inset-0"
            aria-label="Open your island"
          >
            <IslandArt layout={layout} sky={sky} names={data.names} mode="banner" />
          </button>
          <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink">
            Your Island · {layout.total} {layout.total === 1 ? "piece" : "pieces"}
          </span>
          <button type="button" onClick={toggle} aria-label="Hide your island" className="absolute top-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-ink/55 text-white">
            <ChevronUp size={17} />
          </button>
          {toast && (
            <span className="pointer-events-none absolute bottom-2 left-1/2 max-w-[92%] -translate-x-1/2 animate-pop truncate rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white shadow-lift">
              {toast}
            </span>
          )}
        </div>
      ) : (
        <div className="mx-3 mt-2 flex shrink-0 items-center gap-2 lg:mx-auto lg:w-full lg:max-w-xl">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setFull(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#dff3fa] pr-3 pl-2 text-[12px] font-semibold text-[#155a7a]"
          >
            <TreePalm size={15} /> Your Island · {layout.total}
          </button>
          {toast && <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted">{toast}</span>}
          <button type="button" onClick={toggle} aria-label="Show your island" className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted">
            <ChevronDown size={17} />
          </button>
        </div>
      )}
      {full && mounted && <IslandFull data={data} sky={sky} onClose={() => setFull(false)} />}
    </>
  );
}

/** The whole island, full screen: tap a piece to see the message that made it */
function IslandFull({ data, sky, onClose }: { data: IslandData; sky: "day" | "sunset" | "night"; onClose: () => void }) {
  const layout = useMemo(() => layoutIsland(data), [data]);
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const p = picked != null ? layout.pieces[picked] : null;
  const fogLeft = Math.round((layout.fog / 0.9) * 100);

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

  // Save (or share) a picture of the island
  async function save() {
    const el = svg.current;
    if (!el || saving) return;
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
      canvas.width = 780;
      canvas.height = 1688;
      canvas.getContext("2d")?.drawImage(img, 0, 0, 780, 1688);
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

  const next = !layout.boat ? `A boat at 20 messages` : !layout.lighthouse ? `A lighthouse at 100 messages` : null;

  return createPortal(
    <div className="fixed inset-0 z-[85] bg-[#2f86ad] animate-fade-in" role="dialog" aria-modal="true" aria-label="Your island">
      <div className="absolute inset-0" onClick={() => setPicked(null)}>
        <IslandArt ref={svg} layout={layout} sky={sky} names={data.names} mode="full" picked={picked} onPick={(i) => setPicked(i)} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-md items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Back to chat" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink">
          <ChevronLeft size={20} />
        </button>
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-bold">
          Day {layout.days} · {layout.total} {layout.total === 1 ? "piece" : "pieces"}
        </span>
        <button type="button" onClick={save} disabled={saving} aria-label="Save a picture of your island" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink disabled:opacity-60">
          <Download size={18} />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-2 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {p ? (
          <div className="rounded-2xl bg-ink/90 px-4 py-3 text-white">
            <p className="text-[12px] font-semibold text-white/70">{p.label.charAt(0).toUpperCase() + p.label.slice(1)} came from</p>
            <p className="mt-0.5 line-clamp-3 text-[14px] leading-snug">{p.from ? `"${p.from}"` : "a message"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat value={data.unmasked ? "Clear" : `${100 - fogLeft}%`} label={data.unmasked ? "you unmasked" : "fog cleared"} />
            <Stat value={String(layout.pieces.length + (layout.lighthouse ? 1 : 0) + (layout.boat ? 1 : 0))} label="on the island" />
            <Stat value={String(layout.days)} label={layout.days === 1 ? "day" : "days"} />
          </div>
        )}
        <p className="rounded-2xl bg-ink/80 px-4 py-2.5 text-[12.5px] leading-snug text-white">
          {next ? `Every message adds something. Next: ${next}.` : "Every message adds something. Tap a piece to see what made it."}
        </p>
      </div>
    </div>,
    document.body,
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
