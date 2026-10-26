"use client";

import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/scrollLock";
import { thumbFallback, thumbUrl } from "@/lib/photos";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Quote, X } from "lucide-react";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import { promptOf } from "@/lib/things";
import type { Profile } from "@/lib/types";
import { InterestIcon } from "@/components/ui/icons";
import { YouBoth } from "./YouBoth";

export function ProfileSheet({
  profile,
  onClose,
  note,
  shared = [],
  extra,
  footer,
  locked,
  commonWith,
  age: ageIn,
}: {
  profile: Profile;
  onClose: () => void;
  note?: string;
  shared?: string[];
  /** Shown under the note (e.g. locked photos) */
  extra?: React.ReactNode;
  /** Actions pinned to the bottom (e.g. Message) */
  footer?: React.ReactNode;
  /** Their other photos you can't see yet: shown as blurred, locked slides */
  locked?: { count: number; note: string; action?: React.ReactNode };
  /** Their id: shows what you have in common ("You both…") */
  commonWith?: string;
  /** Their age, when you don't have their birthday (Meet) */
  age?: number | null;
}) {
  const [i, setI] = useState(0);
  // Photos that didn't load: shown as their initial instead of a broken image
  const [broken, setBroken] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const photos = profile.photos ?? [];
  const lockedCount = locked?.count ?? 0;
  const slides = photos.length + lockedCount;
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;
  // Age and sex, small, under their name
  const age = ageIn ?? ageFromBirthdate(profile.birthdate ?? null);
  const about = [age ? String(age) : null, gender].filter(Boolean).join(" · ");
  if (!mounted) return null;

  const prev = () => setI(Math.max(0, i - 1));
  const next = () => setI(Math.min(slides - 1, i + 1));

  return createPortal(
    <div
      className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-cream lg:grid lg:place-items-center lg:overflow-hidden lg:bg-ink/55 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={profile.display_name ?? "Profile"}
    >
      <button className="absolute inset-0 hidden cursor-default lg:block" aria-label="Close" onClick={onClose} />
      <div className={clsx("relative mx-auto max-w-md lg:grid lg:h-[min(88vh,780px)] lg:w-full lg:max-w-5xl lg:animate-pop lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[32px] lg:bg-surface lg:pb-0 lg:shadow-lift", footer ? "pb-32" : "pb-12")}>
        {/* Photos */}
        <div className="relative overflow-hidden lg:h-full lg:bg-ink">
          {i >= photos.length && lockedCount > 0 ? (
            // A photo you can't see yet: their main photo, heavily blurred, with a lock
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-brand-ink lg:aspect-auto lg:h-full">
              {photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl(photos[0]) ?? photos[0]} onError={thumbFallback(photos[0])} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "blur(28px)", transform: "scale(1.3)" }} />
              )}
            </div>
          ) : photos[i] && !broken.includes(photos[i]) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photos[i]}
              src={photos[i]}
              alt={profile.display_name ?? ""}
              onError={() => setBroken((b) => [...b, photos[i]])}
              className="aspect-[4/5] w-full animate-fade-in object-cover lg:aspect-auto lg:h-full"
            />
          ) : photos[i] ? (
            <div className="grid aspect-[4/5] w-full place-items-center bg-brand-soft lg:aspect-auto lg:h-full">
              <span className="font-display text-[120px] font-bold text-brand/50">{(profile.display_name ?? "?").trim().charAt(0).toUpperCase() || "?"}</span>
            </div>
          ) : (
            <div className="aspect-[4/5] w-full bg-line lg:aspect-auto lg:h-full" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 lg:from-black/40" />
          {i >= photos.length && locked && (
            <div className="absolute inset-0 z-[1] grid place-items-center p-8 text-center text-white">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur"><Lock size={24} /></span>
                <p className="mt-3 text-[16px] font-semibold">{lockedCount} more {lockedCount === 1 ? "photo" : "photos"}</p>
                <p className="mt-1 text-[13.5px] text-white/80">{locked.note}</p>
                {locked.action && <div className="mt-4 flex justify-center">{locked.action}</div>}
              </div>
            </div>
          )}
          {slides > 1 && (
            <>
              <div className="absolute inset-x-3 top-3 z-[2] flex gap-1">
                {Array.from({ length: slides }, (_, n) => (
                  <span key={n} className={`h-1 flex-1 rounded-full transition ${n === i ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
              {/* Tap the sides to move (narrower on a locked photo, so its button stays tappable) */}
              <button className={clsx("absolute inset-y-0 left-0 z-[2] lg:hidden", i >= photos.length ? "w-1/5" : "w-1/2")} aria-label="Previous photo" onClick={prev} />
              <button className={clsx("absolute inset-y-0 right-0 z-[2] lg:hidden", i >= photos.length ? "w-1/5" : "w-1/2")} aria-label="Next photo" onClick={next} />
              {/* Desktop arrows and thumbnails */}
              <button onClick={prev} disabled={i === 0} aria-label="Previous photo"
                className="absolute top-1/2 left-4 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white disabled:opacity-0 lg:grid">
                <ChevronLeft size={22} />
              </button>
              <button onClick={next} disabled={i === slides - 1} aria-label="Next photo"
                className="absolute top-1/2 right-4 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white disabled:opacity-0 lg:grid">
                <ChevronRight size={22} />
              </button>
              <div className="absolute inset-x-0 bottom-5 z-[2] hidden justify-center gap-2 lg:flex">
                {photos.map((p, n) => (
                  <button key={p} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`}
                    className={`h-14 w-14 overflow-hidden rounded-xl border-2 transition ${n === i ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbUrl(p) ?? p} onError={thumbFallback(p)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {Array.from({ length: lockedCount }, (_, n) => (
                  <button key={`locked-${n}`} onClick={() => setI(photos.length + n)} aria-label={`Locked photo ${n + 1}`}
                    className={`grid h-14 w-14 place-items-center rounded-xl border-2 bg-white/15 text-white backdrop-blur transition ${photos.length + n === i ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <Lock size={18} />
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={onClose} className="absolute top-6 left-4 z-[3] grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95 lg:hidden" aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <button onClick={onClose} className="absolute top-6 right-4 z-[3] grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95 lg:hidden" aria-label="Close">
            <X size={20} />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white lg:hidden">
            <h2 className="font-display text-[36px] leading-none font-semibold">
              {profile.display_name}
            </h2>
            {about && <p className="mt-1.5 text-[14px] text-white/80">{about}</p>}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 px-4 pt-4 lg:overflow-y-auto lg:bg-cream lg:p-8">
          <div className="hidden items-start justify-between gap-4 lg:flex">
            <div>
              <h2 className="font-display text-[44px] leading-none font-semibold">
                {profile.display_name}
              </h2>
              {about && <p className="mt-2 text-[15px] text-muted">{about}</p>}
            </div>
            <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink transition hover:bg-cream" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          {note && <p className="rounded-2xl bg-brand-soft px-4 py-3 text-[13px] font-medium text-brand-ink lg:mt-5">{note}</p>}
          {extra}
          {commonWith && <YouBoth other={commonWith} />}
          {profile.bio && (
            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <Quote size={20} className="text-brand" />
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{profile.bio}</p>
            </section>
          )}
          {(profile.things?.length ?? 0) > 0 && (
            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Things about {profile.display_name?.split(" ")[0] ?? "them"}</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {profile.things!.map((t, i) => (
                  <ThingCard key={i} p={t.p} a={t.a} />
                ))}
              </div>
            </section>
          )}
          {profile.interests?.length > 0 && (
            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Into</h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((t) => {
                  const both = shared.includes(t);
                  return (
                    <span
                      key={t}
                      className={
                        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold " +
                        (both ? "bg-brand text-white" : "bg-brand-soft text-brand-ink")
                      }
                    >
                      <InterestIcon name={t} size={15} /> {t}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
          {footer && (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 pt-3 pb-safe backdrop-blur lg:sticky lg:-mx-8 lg:mt-6 lg:-mb-8 lg:px-8 lg:pb-6">
              <div className="mx-auto max-w-md lg:max-w-none">{footer}</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One of their things: short in the grid, tap to open it up and read it all */
function ThingCard({ p: id, a }: { p: string; a: string }) {
  const [open, setOpen] = useState(false);
  const p = promptOf(id);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className={clsx(
        "relative overflow-hidden rounded-2xl text-left text-white transition-all active:scale-[0.98]",
        open ? "col-span-2 p-4" : "p-3",
      )}
      style={{ background: p.tone }}
    >
      {open && <span aria-hidden className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10" />}
      <span className={clsx("relative block pr-5 font-semibold text-white/80", open ? "text-[13px] leading-snug" : "line-clamp-2 text-[11px] leading-tight")}>{p.text}</span>
      <span className={clsx("relative mt-1 block font-bold break-words", open ? "text-[19px] leading-snug" : "line-clamp-3 text-[14px] leading-snug")}>{a}</span>
      <ChevronDown size={15} className={clsx("absolute top-2.5 right-2.5 text-white/70 transition", open && "rotate-180")} />
    </button>
  );
}
