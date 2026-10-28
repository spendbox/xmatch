"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Photo } from "@/components/ui/Photo";
import { photosPatch, type MyPhoto } from "@/lib/photoSet";
import { useMaskedPhotos } from "./useMaskedPhotos";
import { MASKS } from "@/lib/masks";

/**
 * Shown once to members whose photos Dashpad masked for them: their masked photos, a pencil on
 * each to change the mask, and "Looks good".
 */
export function MaskedNotice({ userId, photos }: { userId: string; photos: MyPhoto[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = useMaskedPhotos({
    supabase,
    userId,
    initial: photos,
    persist: (patch) => {
      supabase.from("profiles").update(patch).eq("id", userId).then(() => {});
    },
  });
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  async function done(goToProfile = false) {
    setSaving(true);
    // Seen: they won't be told again
    const items = set.items.map((i) => (i.mask && !("none" in i.mask) && i.mask.auto ? { ...i, mask: { ...i.mask, auto: false } } : i));
    await supabase.from("profiles").update(photosPatch(items)).eq("id", userId);
    setSaving(false);
    setOpen(false);
    if (goToProfile) router.push("/profile?photos=1");
    else router.refresh();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-cream text-ink" role="dialog" aria-modal="true" aria-label="We masked your photos">
      <div className="mx-auto max-w-md px-5 pt-[max(24px,env(safe-area-inset-top))] pb-36">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase">
          <MaskIcon className="w-4" /> New
        </span>
        <h2 className="mt-3 font-display text-[30px] leading-[1.08] font-black">Your face is now masked</h2>
        <p className="mt-2 text-[14.5px] text-muted">
          Dashpad is masked now. We&apos;ve hidden your face in every photo, so people see your style, not your face, until you both choose to unmask.
        </p>
        <p className="mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-[14px] text-brand-ink">
          <b>Pick your own look.</b> There are {MASKS.length} free masks, from fun to fancy, in any colour. Tap the pencil on a photo, or change them any time in <b>Profile → Photos</b>.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {set.items.map((i, k) => (
            <div key={i.masked} className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-line">
              <Photo src={i.masked} id={userId} small={false} className="h-full w-full object-cover" />
              {k === 0 && <span className="absolute top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-[10.5px] font-extrabold text-ink">Main</span>}
              {set.overlay(i.masked)}
            </div>
          ))}
        </div>
        {set.ui}
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream to-transparent px-5 pt-8 pb-safe">
        <div className="mx-auto max-w-md pb-3">
          <Button size="lg" onClick={() => done()} loading={saving} loadingText="Saving…">
            Looks good
          </Button>
          <button type="button" onClick={() => done(true)} disabled={saving} className="mt-2 w-full py-2 text-center text-[14px] font-bold text-brand">
            Choose different masks in Profile
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
