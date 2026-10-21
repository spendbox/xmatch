"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Quote, X } from "lucide-react";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { InterestIcon } from "@/components/ui/icons";

export function ProfileSheet({
  profile,
  onClose,
  note,
  shared = [],
}: {
  profile: Profile;
  onClose: () => void;
  note?: string;
  shared?: string[];
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
  const age = ageFromBirthdate(profile.birthdate);
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-cream" role="dialog" aria-modal="true" aria-label={profile.display_name ?? "Profile"}>
      <div className="mx-auto max-w-md pb-12">
        <div className="relative">
          {photos[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photos[i]} src={photos[i]} alt={profile.display_name ?? ""} className="aspect-[4/5] w-full animate-fade-in object-cover" />
          ) : (
            <div className="aspect-[4/5] w-full bg-line" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-3 flex gap-1">
                {photos.map((_, n) => (
                  <span key={n} className={`h-1 flex-1 rounded-full transition ${n === i ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
              <button className="absolute inset-y-0 left-0 w-1/2" aria-label="Previous photo" onClick={() => setI(Math.max(0, i - 1))} />
              <button className="absolute inset-y-0 right-0 w-1/2" aria-label="Next photo" onClick={() => setI(Math.min(photos.length - 1, i + 1))} />
            </>
          )}
          <button onClick={onClose} className="absolute top-6 left-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95" aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <button onClick={onClose} className="absolute top-6 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow active:scale-95" aria-label="Close">
            <X size={20} />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
            <h2 className="font-display text-[36px] leading-none font-semibold">
              {profile.display_name}
              {age ? <span className="font-normal text-white/85">, {age}</span> : null}
            </h2>
            {gender && <p className="mt-1.5 text-[14px] text-white/80">{gender}</p>}
          </div>
        </div>

        <div className="space-y-3 px-4 pt-4">
          {note && <p className="rounded-2xl bg-brand-soft px-4 py-3 text-[13px] font-medium text-brand-ink">{note}</p>}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
