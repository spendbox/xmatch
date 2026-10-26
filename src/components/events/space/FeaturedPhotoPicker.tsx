"use client";

import { Photo } from "@/components/ui/Photo";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, EyeOff, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { makeBlur } from "@/lib/eventSpace";
import { Spinner } from "@/components/ui/Button";

/** Choose which of your photos people see (blurred) on the wall. */
export function FeaturedPhotoPicker({
  eventId,
  photos,
  current,
  onChange,
  bare,
}: {
  eventId: string;
  photos: string[];
  current: string | null;
  onChange: (photo: string) => void;
  /** No card around it (inside a sheet) */
  bare?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const selected = current ?? photos[0] ?? null;

  async function choose(photo: string) {
    if (saving || photo === current) return;
    setSaving(photo);
    setError(null);
    setSaved(false);
    const blur = await makeBlur(photo);
    const { error: err } = await supabase.rpc("set_featured_photo", { p_event: eventId, p_photo: photo, p_blur: blur });
    setSaving(null);
    if (err) return setError(err.message || "Couldn't save that photo. Please try again.");
    onChange(photo);
    setSaved(true);
  }

  return (
    <div className={clsx(!bare && "rounded-3xl border border-line bg-surface p-5 shadow-card")}>
      {!bare && (
        <>
          <h2 className="text-[15px] font-semibold">Your featured photo</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            This is the photo people see on the wall. It&apos;s shown <strong className="font-semibold text-ink-soft">blurred</strong> until someone taps to reveal it.
          </p>
        </>
      )}
      {photos.length === 0 ? (
        <Link href="/profile" className="mt-4 flex items-center gap-3 rounded-2xl bg-cream p-4 text-[14px] font-semibold text-brand">
          <ImagePlus size={20} /> Add a photo to your profile
        </Link>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2.5">
          {photos.map((p) => {
            const on = p === selected;
            return (
              <li key={p}>
                <button
                  onClick={() => choose(p)}
                  disabled={!!saving}
                  aria-pressed={on}
                  aria-label={on ? "Featured photo" : "Use this photo"}
                  className={clsx(
                    "relative block aspect-[3/4] w-full overflow-hidden rounded-2xl transition active:scale-[0.97]",
                    on ? "ring-[3px] ring-brand ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100",
                  )}
                >
                  <Photo src={p} className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                  {saving === p && (
                    <span className="absolute inset-0 grid place-items-center bg-white/60 text-brand">
                      <Spinner />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream p-3">
          <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-xl">
            <Photo src={selected} className="h-full w-full scale-110 object-cover blur-md" />
          </span>
          <p className="text-[13px] leading-snug text-muted">
            <EyeOff size={13} className="mr-1 inline align-[-2px]" />
            {saved ? "Saved. " : ""}How others see you until they reveal.
          </p>
        </div>
      )}
      {error && <p className="mt-3 rounded-xl bg-chili-soft px-3 py-2 text-[13px] font-medium text-chili">{error}</p>}
    </div>
  );
}
