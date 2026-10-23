"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Quote, X } from "lucide-react";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { InterestIcon } from "@/components/ui/icons";

export function ProfileSheet({
  profile,
  onClose,
  note,
  shared = [],
  age: ageOverride,
  extra,
  footer,
}: {
  profile: Profile;
  onClose: () => void;
  note?: string;
  shared?: string[];
  /** When there's no birthdate to work it out from */
  age?: number | null;
  /** Shown under the note (e.g. locked photos) */
  extra?: React.ReactNode;
  /** Actions pinned to the bottom (e.g. Message) */
  footer?: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const photos = profile.photos ?? [];
  const age = ageOverride ?? ageFromBirthdate(profile.birthdate);
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;
  if (!mounted) return null;

  const prev = () => setI(Math.max(0, i - 1));
  const next = () => setI(Math.min(photos.length - 1, i + 1));

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
        <div className="relative lg:h-full lg:bg-ink">
          {photos[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photos[i]} src={photos[i]} alt={profile.display_name ?? ""} className="aspect-[4/5] w-full animate-fade-in object-cover lg:aspect-auto lg:h-full" />
          ) : (
            <div className="aspect-[4/5] w-full bg-line lg:aspect-auto lg:h-full" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 lg:from-black/40" />
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-3 flex gap-1">
                {photos.map((_, n) => (
                  <span key={n} className={`h-1 flex-1 rounded-full transition ${n === i ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
              <button className="absolute inset-y-0 left-0 w-1/2 lg:hidden" aria-label="Previous photo" onClick={prev} />
              <button className="absolute inset-y-0 right-0 w-1/2 lg:hidden" aria-label="Next photo" onClick={next} />
              {/* Desktop arrows and thumbnails */}
              <button onClick={prev} disabled={i === 0} aria-label="Previous photo"
                className="absolute top-1/2 left-4 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white disabled:opacity-0 lg:grid">
                <ChevronLeft size={22} />
              </button>
              <button onClick={next} disabled={i === photos.length - 1} aria-label="Next photo"
                className="absolute top-1/2 right-4 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white disabled:opacity-0 lg:grid">
                <ChevronRight size={22} />
              </button>
              <div className="absolute inset-x-0 bottom-5 hidden justify-center gap-2 lg:flex">
                {photos.map((p, n) => (
                  <button key={p} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`}
                    className={`h-14 w-14 overflow-hidden rounded-xl border-2 transition ${n === i ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={onClose} className="absolute top-6 left-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95 lg:hidden" aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <button onClick={onClose} className="absolute top-6 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95 lg:hidden" aria-label="Close">
            <X size={20} />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white lg:hidden">
            <h2 className="font-display text-[36px] leading-none font-semibold">
              {profile.display_name}
              {age ? <span className="font-normal text-white/85">, {age}</span> : null}
            </h2>
            {gender && <p className="mt-1.5 text-[14px] text-white/80">{gender}</p>}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 px-4 pt-4 lg:overflow-y-auto lg:bg-cream lg:p-8">
          <div className="hidden items-start justify-between gap-4 lg:flex">
            <div>
              <h2 className="font-display text-[44px] leading-none font-semibold">
                {profile.display_name}
                {age ? <span className="font-normal text-muted">, {age}</span> : null}
              </h2>
              {gender && <p className="mt-2 text-[15px] text-muted">{gender}</p>}
            </div>
            <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink transition hover:bg-cream" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          {note && <p className="rounded-2xl bg-brand-soft px-4 py-3 text-[13px] font-medium text-brand-ink lg:mt-5">{note}</p>}
          {extra}
          {profile.bio && (
            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <Quote size={20} className="text-brand" />
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{profile.bio}</p>
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
