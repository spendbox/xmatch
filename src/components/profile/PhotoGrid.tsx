"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import clsx from "clsx";
import { Spinner } from "@/components/ui/Button";

export const MAX_PHOTOS = 6;

export function PhotoGrid({
  photos,
  onAdd,
  onRemove,
}: {
  photos: string[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        if (!f.type.startsWith("image/")) continue;
        await onAdd(f);
      }
    } catch {
      setError("That photo didn't upload. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const slots = Array.from({ length: MAX_PHOTOS });
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((_, i) => {
          const url = photos[i];
          const isNext = i === photos.length;
          if (url) {
            return (
              <div key={url} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink">
                    Main
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-white"
                >
                  <X size={15} />
                </button>
              </div>
            );
          }
          return (
            <button
              key={`slot-${i}`}
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
