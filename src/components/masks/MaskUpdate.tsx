"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Pencil, Shuffle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Spinner, tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { drawMasked, loadOriginal, maskFor, maskName, PLACEHOLDER, STARTER_MASKS, starterMask } from "@/lib/maskedPhotos";
import type { PhotoMask } from "@/lib/types";
import { MASKS } from "@/lib/masks";
import { MaskedPreview } from "./MaskedPreview";
import { MaskEditor } from "./MaskEditor";
import { photosPatch, type MyPhoto } from "./useMaskedPhotos";

type Masked = Exclude<PhotoMask, { none: true }>;
type Row = { real: string; src: string; canvas: HTMLCanvasElement | null; mask: Masked | null; masked?: string; choice?: "keep" | "remove"; failed?: boolean };

const LATER_KEY = "dp_mask_later";
const today = () => new Date().toISOString().slice(0, 10);
/** Profile's "Mask my photos" button opens this */
export const OPEN_MASKING = "dp-open-masking";

/**
 * For people whose photos aren't masked yet: a pop-up about masks, then every photo masked for
 * them in one go, a quick check, and done. Until then, people see a plain mask instead of their photos.
 */
export function MaskUpdate({ userId, photos }: { userId: string; photos: MyPhoto[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<null | "pop" | "work" | "review" | "saving" | "done">(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todo = photos.filter((p) => p.masked === PLACEHOLDER);

  useEffect(() => {
    setMounted(true);
    let later = "";
    try {
      later = localStorage.getItem(LATER_KEY) ?? "";
    } catch {
      /* nothing kept */
    }
    if (todo.length && later !== today()) setPhase("pop");
    const open = () => setPhase((p) => p ?? "pop");
    window.addEventListener(OPEN_MASKING, open);
    return () => window.removeEventListener(OPEN_MASKING, open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !phase || (!todo.length && phase !== "done")) return null;

  function later() {
    try {
      localStorage.setItem(LATER_KEY, today());
    } catch {
      /* nothing kept */
    }
    setPhase(null);
  }

  async function start() {
    tapFeedback();
    setPhase("work");
    setError(null);
    const out: Row[] = [];
    const used: string[] = photos.filter((p) => p.mask && !("none" in p.mask)).map((p) => (p.mask as Masked).mask);
    for (let i = 0; i < todo.length; i++) {
      setProgress(i);
      const real = todo[i].real;
      try {
        const canvas = await loadOriginal(real);
        const id = starterMask(used);
        const mask = await maskFor(canvas, id);
        if (mask) used.push(id);
        out.push({ real, canvas, src: canvas.toDataURL("image/jpeg", 0.85), mask });
      } catch {
        // Couldn't open it here: never kept unmasked (try again, or remove it)
        out.push({ real, canvas: null, src: real, mask: null, failed: true });
      }
    }
    setRows(out);
    setPhase("review");
  }

  async function retry(i: number) {
    tapFeedback();
    const r = rows[i];
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, failed: false, choice: undefined, src: x.src } : x)));
    try {
      const canvas = await loadOriginal(r.real);
      const used = rows.map((x) => x.mask?.mask).filter(Boolean) as string[];
      const mask = await maskFor(canvas, starterMask(used));
      setRows((rs) => rs.map((x, j) => (j === i ? { ...x, canvas, src: canvas.toDataURL("image/jpeg", 0.85), mask } : x)));
    } catch {
      setRows((rs) => rs.map((x, j) => (j === i ? { ...x, failed: true } : x)));
    }
  }

  function shuffle() {
    tapFeedback();
    const pool = [...STARTER_MASKS, ...MASKS.map((m) => m.id)].sort(() => Math.random() - 0.5);
    setRows((rs) => rs.map((r, i) => (r.mask ? { ...r, mask: { ...r.mask, mask: pool[i % pool.length] } } : r)));
  }

  async function save() {
    if (rows.some((r) => r.failed && r.choice !== "remove")) return setError("One photo couldn't be opened. Try again, or remove it.");
    const unanswered = rows.find((r) => !r.mask && !r.choice);
    if (unanswered) return setError("Tell us about the photo with no face found first.");
    const kept = rows.filter((r) => r.choice !== "remove");
    const already = photos.filter((p) => p.masked !== PLACEHOLDER);
    if (!kept.length && !already.length) return setError("Keep at least one photo, or add a new one in Profile.");
    setPhase("saving");
    setError(null);
    try {
      const done: MyPhoto[] = [];
      for (const r of kept) {
        if (r.mask && r.canvas) {
          const masked = await uploadPhoto(supabase, userId, await drawMasked(r.canvas, r.mask));
          done.push({ masked, real: r.real, mask: r.mask });
        } else {
          // No person in it: nothing to hide
          done.push({ masked: r.real, real: r.real, mask: { none: true } });
        }
      }
      // The masked photos take the place of the plain masks, in the same order
      let k = 0;
      const next: MyPhoto[] = [];
      for (const p of photos) {
        if (p.masked !== PLACEHOLDER) next.push(p);
        else {
          const r = rows[k++];
          if (r.choice !== "remove") next.push(done.shift()!);
        }
      }
      const { error: err } = await supabase.from("profiles").update(photosPatch(next)).eq("id", userId);
      if (err) throw err;
      rows.filter((r) => r.choice === "remove").forEach((r) => deletePhoto(supabase, r.real));
      setPhase("done");
      router.refresh();
    } catch {
      setError("Couldn't save your masked photos. Please try again.");
      setPhase("review");
    }
  }

  const editingRow = editing !== null ? rows[editing] : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#120b2e]/65 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Mask your photos">
      {phase === "pop" && (
        <div className="absolute inset-x-3 top-[max(40px,env(safe-area-inset-top))] bottom-3 mx-auto flex max-w-md flex-col overflow-hidden rounded-[34px] text-white shadow-[0_0_0_2px_rgba(242,179,61,0.55)]" style={{ background: "radial-gradient(100% 60% at 50% 25%, #5b3fd9 0%, #2b1d73 45%, #120b2e 100%)" }}>
          <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-6 text-center">
            <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase">New</span>
            <h2 className="mt-3 font-display text-[32px] leading-[1.05] font-black">Mask your photos</h2>
            <p className="mt-2 text-[14.5px] text-white/75">Dashpad is masked now. People see your style, not your face, until you both choose to unmask.</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="w-[118px]">
                <MaskedPreview src={`/api/media/original?url=${encodeURIComponent(todo[0].real)}`} mask={null} className="aspect-[4/5] rounded-[20px] bg-white/10 opacity-80" />
                <span className="mt-1.5 block text-[11.5px] text-white/60">Your photo</span>
              </span>
              <ChevronRight className="shrink-0 text-gold" />
              <span className="w-[118px]">
                <span className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[20px] shadow-[0_0_0_3px_#f2b33d]" style={{ background: "radial-gradient(circle at 50% 35%, #7a5cf0, #2b1d73)" }}>
                  <MaskIcon className="w-16 text-gold" />
                </span>
                <span className="mt-1.5 block text-[11.5px] font-bold text-gold">What people see</span>
              </span>
            </div>
            <div className="mt-5 grid w-full gap-2 text-left text-[13.5px]">
              {["Free. 61 masks, fun to fancy", "A different mask on each photo", "We place them for you in seconds"].map((t) => (
                <span key={t} className="flex items-center gap-2.5 rounded-[14px] bg-white/10 px-3 py-2.5">
                  <Check size={16} className="shrink-0 text-gold" /> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5 px-5 pt-4 pb-5 text-center">
            <button type="button" onClick={start} className="rounded-full bg-gold py-4 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e] active:translate-y-0.5">
              Mask my photos
            </button>
            <button type="button" onClick={later} className="py-1.5 text-[13.5px] font-semibold text-white/60">
              Later
            </button>
            <span className="text-[11.5px] text-white/45">Until you do, people see a plain mask instead of your photos.</span>
          </div>
        </div>
      )}

      {phase === "work" && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-white">
          <div>
            <Spinner className="mx-auto h-10 w-10" />
            <p className="mt-4 text-[18px] font-bold">Masking photo {progress + 1} of {todo.length}…</p>
            <p className="mt-1 text-[14px] text-white/70">Finding your face and picking a mask</p>
          </div>
        </div>
      )}

      {(phase === "review" || phase === "saving") && (
        <div className="absolute inset-0 overflow-y-auto bg-cream text-ink">
          <div className="mx-auto max-w-md px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
            <div className="flex items-center justify-end">
              <button type="button" onClick={shuffle} className="inline-flex items-center gap-1.5 text-[14px] font-bold text-brand">
                <Shuffle size={16} /> Shuffle masks
              </button>
            </div>
            <h2 className="mt-2 font-display text-[28px] leading-[1.1] font-black">We masked your {rows.length === 1 ? "photo" : `${rows.length} photos`}</h2>
            <p className="mt-1.5 text-[14px] text-muted">Tap the pencil to change a mask. You can change them any time in Profile.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {rows.map((r, i) => (
                <div key={r.real} className="relative overflow-hidden rounded-[22px] bg-line">
                  <MaskedPreview src={r.src} mask={r.mask} className={"aspect-[4/5] " + (r.choice === "remove" ? "opacity-30" : "")} />
                  {r.mask ? (
                    <>
                      <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
                        <MaskIcon className="w-3.5" /> {maskName(r.mask.mask)}
                      </span>
                      <button type="button" onClick={() => setEditing(i)} aria-label="Change this mask" className="absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-full bg-white text-brand shadow-card">
                        <Pencil size={14} />
                      </button>
                    </>
                  ) : r.failed ? (
                    <div className="absolute inset-x-2 bottom-2 rounded-[14px] bg-white/95 p-2.5 text-[12px] leading-snug">
                      <b>Couldn&apos;t open this photo.</b> Check your connection.
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => retry(i)} className="rounded-full bg-brand py-1.5 text-[11.5px] font-bold text-white">
                          Try again
                        </button>
                        <button type="button" onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, choice: "remove" } : x)))} className={"inline-flex items-center justify-center gap-1 rounded-full py-1.5 text-[11.5px] font-bold " + (r.choice === "remove" ? "bg-chili text-white" : "bg-chili-soft text-chili")}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-x-2 bottom-2 rounded-[14px] bg-white/95 p-2.5 text-[12px] leading-snug">
                      <b>No face found.</b> Is there a person in it?
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, choice: "keep" } : x)))} className={"rounded-full py-1.5 text-[11.5px] font-bold " + (r.choice === "keep" ? "bg-brand text-white" : "bg-brand-soft text-brand-ink")}>
                          No person
                        </button>
                        <button type="button" onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, choice: "remove" } : x)))} className={"inline-flex items-center justify-center gap-1 rounded-full py-1.5 text-[11.5px] font-bold " + (r.choice === "remove" ? "bg-chili text-white" : "bg-chili-soft text-chili")}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rows.some((r) => r.choice === "remove") && <p className="mt-3 text-[12.5px] text-muted">Photos with a person we can&apos;t mask are removed. Add a clearer one in Profile.</p>}
          </div>
          <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream to-transparent px-5 pt-8 pb-safe">
            <div className="mx-auto max-w-md space-y-2 pb-3">
              {error && <p className="text-center text-[14px] font-medium text-chili">{error}</p>}
              <Button size="lg" onClick={save} loading={phase === "saving"} loadingText="Saving your masked photos…">
                Looks good
              </Button>
            </div>
          </div>
          {editingRow?.mask && (
            <MaskEditor
              open
              layer="z-[80]"
              src={editingRow.src}
              mask={editingRow.mask}
              onClose={() => setEditing(null)}
              onSave={(m) => {
                setRows((rs) => rs.map((x, j) => (j === editing ? { ...x, mask: m } : x)));
                setEditing(null);
              }}
            />
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-white">
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint">
              <Check size={32} />
            </span>
            <p className="mt-4 font-display text-[28px] font-black">You&apos;re masked up</p>
            <p className="mt-1 text-[14.5px] text-white/75">Change any mask in Profile, any time. Your face only shows when you both unmask.</p>
            <button type="button" onClick={() => setPhase(null)} className="mt-6 rounded-full bg-gold px-8 py-3.5 text-[16px] font-extrabold text-ink">
              Done
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
