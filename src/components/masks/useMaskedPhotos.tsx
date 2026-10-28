"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { drawMasked, loadOriginal, maskName, prepare, starterMask } from "@/lib/maskedPhotos";
import type { PhotoMask, Profile } from "@/lib/types";
import { MaskEditor } from "./MaskEditor";

/** One of your photos: the masked copy everyone sees, the original, and the mask it wears */
export type MyPhoto = { masked: string; real: string; mask: PhotoMask | null };
type Masked = Exclude<PhotoMask, { none: true }>;

/** A problem to show as it is (not "please try again") */
export class PhotoProblem extends Error {
  name = "PhotoProblem";
}

export function photosOf(p: Pick<Profile, "photos" | "real_photos" | "photo_masks">): MyPhoto[] {
  const masked = p.photos ?? [];
  const real = p.real_photos ?? masked;
  const masks = p.photo_masks ?? [];
  return masked.map((m, i) => ({ masked: m, real: real[i] ?? m, mask: masks[i] ?? null }));
}

export function photosPatch(items: MyPhoto[]) {
  return { photos: items.map((i) => i.masked), real_photos: items.map((i) => i.real), photo_masks: items.map((i) => i.mask ?? { none: true as const }) };
}

const isMasked = (m: PhotoMask | null): m is Masked => !!m && !("none" in m);

/**
 * Your photos while you add and change them. Every new photo is masked straight away: the face is
 * found and covered (a different mask for each photo), and both copies are saved.
 */
export function useMaskedPhotos({ supabase, userId, initial, persist }: { supabase: SupabaseClient; userId: string; initial: MyPhoto[]; persist?: (patch: ReturnType<typeof photosPatch>) => void }) {
  const [items, setItems] = useState(initial);
  const latest = useRef(initial);
  const [ask, setAsk] = useState<{ src: string; answer: (a: "none" | "person") => void } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Originals already open on this phone (so changing a mask doesn't download them again)
  const canvases = useRef(new Map<string, HTMLCanvasElement>());

  function commit(next: MyPhoto[]) {
    latest.current = next;
    setItems(next);
    persist?.(photosPatch(next));
  }

  async function add(file: File) {
    const used = latest.current.map((i) => (isMasked(i.mask) ? i.mask.mask : "")).filter(Boolean);
    const prep = await prepare(file, starterMask(used));
    if (prep.kind === "none") {
      const src = URL.createObjectURL(prep.photo);
      const answer = await new Promise<"none" | "person">((resolve) => setAsk({ src, answer: resolve }));
      setAsk(null);
      URL.revokeObjectURL(src);
      if (answer === "person") throw new PhotoProblem("We couldn't find the face in that photo. Try one where your face is clear and facing the camera.");
      const url = await uploadPhoto(supabase, userId, prep.photo);
      commit([...latest.current, { masked: url, real: url, mask: { none: true } }]);
      return;
    }
    const blob = await drawMasked(prep.canvas, prep.mask);
    const [real, masked] = await Promise.all([uploadPhoto(supabase, userId, prep.photo), uploadPhoto(supabase, userId, blob)]);
    canvases.current.set(real, prep.canvas);
    commit([...latest.current, { masked, real, mask: prep.mask }]);
  }

  function remove(masked: string) {
    const item = latest.current.find((i) => i.masked === masked);
    if (!item) return;
    commit(latest.current.filter((i) => i !== item));
    deletePhoto(supabase, item.masked);
    if (item.real !== item.masked) deletePhoto(supabase, item.real);
  }

  function reorder(order: string[]) {
    commit(order.map((u) => latest.current.find((i) => i.masked === u)!).filter(Boolean));
  }

  const editingItem = items.find((i) => i.masked === editing) ?? null;

  async function saveMask(m: Masked) {
    const item = latest.current.find((i) => i.masked === editing);
    if (!item) return;
    setSaving(true);
    setEditError(null);
    try {
      const canvas = canvases.current.get(item.real) ?? (await loadOriginal(item.real));
      canvases.current.set(item.real, canvas);
      const blob = await drawMasked(canvas, m);
      const masked = await uploadPhoto(supabase, userId, blob);
      commit(latest.current.map((i) => (i === item ? { ...i, masked, mask: m } : i)));
      deletePhoto(supabase, item.masked);
      setEditing(null);
    } catch {
      setEditError("Couldn't save the mask. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  /** On each photo in the grid: its mask, and a pencil to change it */
  function overlay(masked: string) {
    const item = items.find((i) => i.masked === masked);
    if (!item) return null;
    return (
      <>
        <span className="pointer-events-none absolute top-1.5 left-1.5 inline-flex max-w-[70%] items-center gap-1 truncate rounded-full bg-ink/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
          <MaskIcon className="w-3.5 shrink-0" /> {isMasked(item.mask) ? maskName(item.mask.mask) : "No face"}
        </span>
        {isMasked(item.mask) && (
          <button
            type="button"
            onClick={() => setEditing(item.masked)}
            aria-label="Change this photo's mask"
            className="absolute right-1.5 bottom-1.5 grid h-8 w-8 place-items-center rounded-full bg-white text-brand shadow-card"
          >
            <Pencil size={14} />
          </button>
        )}
      </>
    );
  }

  const ui = (
    <>
      {ask && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-ink/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Is there a face in this photo?">
          <div className="w-full max-w-md rounded-t-[28px] bg-surface p-5 pb-safe shadow-lift sm:rounded-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ask.src} alt="" className="mx-auto max-h-[38dvh] rounded-[18px] object-contain" />
            <p className="mt-4 text-[18px] font-bold">We couldn&apos;t find a face</p>
            <p className="mt-1 text-[14px] text-muted">Is there a person in this photo? Everyone&apos;s face is hidden with a mask, so we need to find it.</p>
            <div className="mt-4 grid gap-2">
              <Button size="lg" onClick={() => ask.answer("none")}>
                No person in it
              </Button>
              <Button size="lg" variant="ghost" onClick={() => ask.answer("person")}>
                Yes, there&apos;s a person
              </Button>
            </div>
          </div>
        </div>
      )}
      {editingItem && isMasked(editingItem.mask) && (
        <MaskEditor
          open
          src={canvases.current.has(editingItem.real) ? canvases.current.get(editingItem.real)!.toDataURL("image/jpeg", 0.8) : `/api/media/original?url=${encodeURIComponent(editingItem.real)}`}
          mask={editingItem.mask}
          saving={saving}
          onClose={() => !saving && setEditing(null)}
          onSave={saveMask}
        />
      )}
      {editError && <p className="mt-2 text-[14px] text-chili">{editError}</p>}
    </>
  );

  return { items, urls: items.map((i) => i.masked), add, remove, reorder, overlay, ui, setItems: commit };
}
