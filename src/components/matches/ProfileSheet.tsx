"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ageFromBirthdate } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export function ProfileSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [i, setI] = useState(0);
  const photos = profile.photos ?? [];
  const age = ageFromBirthdate(profile.birthdate);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-cream animate-fade-up" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-md pb-10">
        <div className="relative">
          {photos[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[i]} alt={profile.display_name ?? ""} className="aspect-[4/5] w-full object-cover" />
          ) : (
            <div className="aspect-[4/5] w-full bg-line" />
          )}
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-3 flex gap-1">
                {photos.map((_, n) => (
                  <span key={n} className={`h-1 flex-1 rounded-full ${n === i ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
              <button className="absolute inset-y-0 left-0 w-1/2" aria-label="Previous photo" onClick={() => setI(Math.max(0, i - 1))} />
              <button className="absolute inset-y-0 right-0 w-1/2" aria-label="Next photo" onClick={() => setI(Math.min(photos.length - 1, i + 1))} />
            </>
          )}
          <button onClick={onClose} className="absolute top-6 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pt-5">
          <h2 className="font-display text-[30px] font-semibold">
            {profile.display_name}
            {age ? <span className="font-normal text-muted">, {age}</span> : null}
          </h2>
          {profile.bio && <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">{profile.bio}</p>}
          {profile.interests?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.interests.map((t) => (
                <span key={t} className="rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] font-semibold text-brand-ink">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
