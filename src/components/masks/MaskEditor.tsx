"use client";

import { useEffect, useState } from "react";
import { coverage, sizeRange } from "@/lib/maskedPhotos";
import clsx from "clsx";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { CATS, MASKS, TRIMS, maskUrl } from "@/lib/masks";
import type { PhotoMask } from "@/lib/types";
import { MaskedPreview } from "./MaskedPreview";

type Masked = Exclude<PhotoMask, { none: true }>;

export const MASK_COLOURS = ["#e8b143", "#1d1a26", "#f7f0e6", "#d92f3a", "#ff3fa4", "#b44cff", "#5b3fd9", "#253a8f", "#4f86f7", "#0f8a8a", "#1f9d6b", "#f2741f"];

/**
 * Changing a photo's mask: the design, its colour and its trim. The mask stays where the face
 * is (it was placed over the face for you and can't be moved off it).
 */
export function MaskEditor({ open, src, mask, onClose, onSave, saving, layer }: { open: boolean; src: string; mask: Masked; onClose: () => void; onSave: (m: Masked) => void; saving?: boolean; layer?: string }) {
  const [draft, setDraft] = useState<Masked>(mask);
  const [cat, setCat] = useState("all");
  const [opened, setOpened] = useState(mask);
  // A different photo opened: start from its mask
  if (opened !== mask) {
    setOpened(mask);
    setDraft(mask);
  }
  const shown = MASKS.filter((m) => cat === "all" || m.cat === cat);

  // Size: how big the mask is next to the size that just covers the whole face (same for every face)
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setRatio(i.naturalWidth / i.naturalHeight);
    i.src = src;
  }, [src]);
  const fitOf = (f: Masked["faces"][number]) => f.fit ?? f.s / 1.06;
  const range = ratio
    ? draft.faces.reduce((acc, f) => {
        const r = sizeRange(f, ratio);
        return { min: Math.max(acc.min, r.min / r.fit), max: Math.min(acc.max, r.max / r.fit) };
      }, { min: 0, max: 9 })
    : null;
  const k = draft.faces[0] ? draft.faces[0].s / fitOf(draft.faces[0]) : 1;
  const covered = ratio ? Math.min(...draft.faces.map((f) => coverage(f, ratio))) : 1;
  const resize = (next: number) => setDraft((d) => ({ ...d, faces: d.faces.map((f) => ({ ...f, s: fitOf(f) * next })) }));
  const set = (patch: Partial<Masked>) => {
    tapFeedback();
    setDraft((d) => ({ ...d, ...patch }));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change mask"
      subtitle="Free · it stays on your face"
      icon={<MaskIcon className="w-6" />}
      layer={layer}
      footer={
        <Button size="lg" onClick={() => onSave(draft)} loading={saving} loadingText="Saving…">
          Save mask
        </Button>
      }
    >
      <MaskedPreview src={src} mask={draft} natural className="mx-auto w-[64%] rounded-[24px] bg-line shadow-card" />

      {range && draft.faces.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[13px]">
            <label htmlFor="mask-size" className="font-bold">
              Size
            </label>
            <span className={covered >= 0.995 ? "font-semibold text-mint" : "font-semibold text-[#8a5a00]"}>
              {covered >= 0.995 ? "Covers your whole face" : `Covers ${Math.round(covered * 100)}% of your face`}
            </span>
          </div>
          <input
            id="mask-size"
            type="range"
            min={range.min}
            max={range.max}
            step={0.005}
            value={Math.min(range.max, Math.max(range.min, k))}
            onChange={(e) => resize(Number(e.target.value))}
            className="mt-2 w-full accent-brand"
          />
          <p className="mt-1 text-[12px] text-muted">It always covers at least 70% of your face.</p>
        </div>
      )}

      <div className="no-scrollbar mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1">
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
      <div className="mt-3 grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto p-0.5">
        {shown.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => set({ mask: m.id })}
            aria-pressed={draft.mask === m.id}
            aria-label={m.name}
            className={clsx("grid aspect-square place-items-center rounded-[16px] bg-cream transition", draft.mask === m.id && "ring-[2.5px] ring-brand")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={maskUrl(m.id, draft.color, draft.trim)} alt="" className="w-[88%]" loading="lazy" />
          </button>
        ))}
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
