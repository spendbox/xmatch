"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Move, Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { CATS, MASKS, TRIMS, maskUrl } from "@/lib/masks";
import type { PhotoMask } from "@/lib/types";
import { MaskedPreview } from "./MaskedPreview";
import { MaskAdjust } from "./MaskAdjust";

type Masked = Exclude<PhotoMask, { none: true }>;

export const MASK_COLOURS = ["#e8b143", "#1d1a26", "#f7f0e6", "#d92f3a", "#ff3fa4", "#b44cff", "#5b3fd9", "#253a8f", "#4f86f7", "#0f8a8a", "#1f9d6b", "#f2741f"];

/**
 * Changing a photo's mask: the design, its colour and its trim. It's placed over the face for you;
 * "Move & resize" lets you move, resize and turn it to fit (full masks only a little, so they keep
 * hiding the face).
 */
export function MaskEditor({ open, src, mask, onClose, onSave, saving, layer }: { open: boolean; src: string; mask: Masked; onClose: () => void; onSave: (m: Masked) => void; saving?: boolean; layer?: string }) {
  const [draft, setDraft] = useState<Masked>(mask);
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [opened, setOpened] = useState(mask);
  // A different photo opened: start from its mask
  if (opened !== mask) {
    setOpened(mask);
    setDraft(mask);
  }
  // Search by name or group (for example "eyo", "cat", "flag")
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => MASKS.filter((m) => (q ? m.name.toLowerCase().includes(q) || m.cat.includes(q) : cat === "all" || m.cat === cat)),
    [cat, q],
  );

  const set = (patch: Partial<Masked>) => {
    tapFeedback();
    setDraft((d) => ({ ...d, ...patch }));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change mask"
      subtitle="Free · move, resize or turn it to fit"
      icon={<MaskIcon className="w-6" />}
      layer={layer}
      footer={
        <Button size="lg" onClick={() => onSave(draft)} loading={saving} loadingText="Saving…">
          Save mask
        </Button>
      }
    >
      <button type="button" onClick={() => setAdjusting(true)} aria-label="Move, resize or turn the mask" className="mx-auto block w-[64%]">
        <MaskedPreview src={src} mask={draft} natural className="w-full rounded-[24px] bg-line shadow-card" />
      </button>
      <div className="mt-2.5 flex justify-center">
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setAdjusting(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-soft px-4 text-[14px] font-bold text-brand-ink"
        >
          <Move size={16} /> Move & resize
        </button>
      </div>
      {adjusting && <MaskAdjust src={src} mask={draft} onChange={setDraft} onDone={() => setAdjusting(false)} />}

      <label className="mt-4 flex h-11 items-center gap-2 rounded-full bg-cream px-4">
        <Search size={17} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${MASKS.length} masks`}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-muted">
            <X size={16} />
          </button>
        )}
      </label>
      {!q && (
        <div className="no-scrollbar mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {CATS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCat(id)}
              className={clsx("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold", cat === id ? "bg-ink text-white" : "bg-cream text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid max-h-[320px] grid-cols-4 gap-2 overflow-y-auto p-0.5">
        {shown.map((m) => (
          <Thumb key={m.id} id={m.id} name={m.name} color={draft.color} trim={draft.trim} on={draft.mask === m.id} onPick={() => set({ mask: m.id })} />
        ))}
        {!shown.length && <p className="col-span-4 py-6 text-center text-[14px] text-muted">No masks called &ldquo;{query}&rdquo;</p>}
      </div>

      <p className="mt-4 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">Colour</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => set({ color: null })}
          className={clsx("h-8 rounded-full px-3 text-[12px] font-bold", draft.color === null ? "bg-ink text-white" : "bg-cream text-muted")}
        >
          Original
        </button>
        {MASK_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set({ color: c })}
            aria-label={`Colour ${c}`}
            className={clsx("h-8 w-8 rounded-full ring-1 ring-black/10", draft.color === c && "ring-2 ring-brand ring-offset-2")}
            style={{ background: c }}
          />
        ))}
        <label className="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} aria-label="Any colour">
          <input type="color" className="absolute inset-0 opacity-0" value={draft.color ?? "#e8b143"} onChange={(e) => set({ color: e.target.value })} />
        </label>
      </div>

      <p className="mt-4 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">Trim</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.entries(TRIMS) as [string, { name: string; hi: string; mid: string; lo: string }][]).map(([id, t]) => (
          <button
            key={id}
            type="button"
            onClick={() => set({ trim: id })}
            className={clsx("inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px] font-bold", draft.trim === id ? "bg-ink text-white" : "bg-cream text-ink")}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${t.hi}, ${t.mid} 45%, ${t.lo})` }} />
            {t.name}
            {draft.trim === id && <Check size={14} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** One mask in the grid. It's only drawn once it scrolls into view, so hundreds of masks stay quick. */
const Thumb = memo(function Thumb({ id, name, color, trim, on, onPick }: { id: string; name: string; color: string | null; trim: string; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const url = useMemo(() => (seen ? maskUrl(id, color, trim) : null), [seen, id, color, trim]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPick}
      aria-pressed={on}
      aria-label={name}
      title={name}
      className={clsx("grid aspect-square place-items-center rounded-[16px] bg-cream transition", on && "ring-[2.5px] ring-brand")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="w-[88%]" /> : <span className="h-1/2 w-1/2 rounded-full bg-line" />}
    </button>
  );
});
