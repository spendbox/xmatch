"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Photo } from "@/components/ui/Photo";
import { Spinner, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import type { ExplorePerson } from "@/lib/explore";

/**
 * Someone's photos on their Explore card: swipe through them like Instagram (dots underneath).
 * Photos you haven't unlocked show as one blurred slide with Unlock (or "free once you're
 * connected"). Tap a photo to see their profile; double-tap to wave.
 */
export function CardPhotos({
  person: p,
  overlay,
  onOpen,
  onDoubleTap,
  photosPaid,
  photosCost,
  onUnlocked,
  demo,
  tall,
}: {
  person: ExplorePerson;
  /** The whole card is the photo (Explore): taller, with room for the words at the bottom */
  tall?: boolean;
  /** Labels drawn over the photos (masked, you both like…) */
  overlay?: React.ReactNode;
  onOpen: () => void;
  /** Double-tap: wave. Returns false when there's no wave to send (already waved, or you chat already) */
  onDoubleTap: () => boolean;
  photosPaid: boolean;
  photosCost: number;
  onUnlocked?: () => void;
  demo?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const shown = (p.photos?.length ? p.photos : [p.photo]).filter((x): x is string => !!x);
  const locked = Math.max(0, (p.photo_count ?? shown.length) - shown.length);
  const slides = shown.length + (locked > 0 ? 1 : 0);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  // One tap opens their profile; a second tap within a moment waves instead
  function tap() {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      // Only a wave that actually goes out gets the 👋
      if (onDoubleTap()) {
        tapFeedback();
        setBurst(Date.now());
      }
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      tapFeedback();
      onOpen();
    }, 260);
  }

  async function unlock() {
    tapFeedback();
    if (demo) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("unlock_photos", { p_id: p.id });
    setBusy(false);
    if (err) return setError(err.message.includes("NOT_ENOUGH_KEYS") ? "keys" : err.message.replace(/^.*?: /, "") || "Couldn't unlock. Try again.");
    onUnlocked?.();
  }

  return (
    <div className={clsx("relative w-full overflow-hidden bg-brand-soft", tall ? "aspect-[4/5.6]" : "aspect-[4/4.4]")}>
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
      >
        {shown.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={tap}
            className="relative h-full w-full shrink-0 snap-center [touch-action:pan-x_pan-y]"
            aria-label={`${p.name}'s photo ${i + 1} of ${slides}. Tap to see their profile, double-tap to wave`}
          >
            <Photo src={src} id={p.id} gender={p.gender} loading="lazy" small={false} className="h-full w-full object-cover" />
          </button>
        ))}
        {shown.length === 0 && (
          <button type="button" onClick={tap} className="grid h-full w-full shrink-0 place-items-center text-[40px] font-semibold text-brand">
            {p.name.charAt(0)}
          </button>
        )}
        {/* Their other photos, blurred until you unlock them or connect */}
        {locked > 0 && (
          <div className="relative h-full w-full shrink-0 snap-center overflow-hidden">
            {shown[0] && <Photo src={shown[0]} id={p.id} gender={p.gender} loading="lazy" className="h-full w-full scale-110 object-cover blur-2xl" />}
            <div className={clsx("absolute inset-0 grid place-items-center bg-black/30", tall && "pb-44")}>
              <div className="flex flex-col items-center gap-2 px-6 text-center text-white">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20">
                  <Lock size={22} />
                </span>
                <p className="text-[15px] font-semibold">
                  {locked} more {locked === 1 ? "photo" : "photos"}
                </p>
                {photosPaid ? (
                  error === "keys" ? (
                    <Link href="/wallet" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold px-4 text-[14px] font-bold text-ink">
                      <KeyCoin size={16} /> Get Keys
                    </Link>
                  ) : (
                    <button type="button" onClick={unlock} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold px-4 text-[14px] font-bold text-ink disabled:opacity-70">
                      {busy ? <Spinner className="h-4 w-4" /> : null}
                      Unlock{photosCost > 0 ? (
                        <>
                          {" "}
                          · <KeyCoin size={16} /> {photosCost}
                        </>
                      ) : null}
                    </button>
                  )
                ) : null}
                <p className="text-[11.5px] text-white/80">{error && error !== "keys" ? error : "Free once you're connected"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Labels over the photos (they don't block swiping or tapping) */}
      <div className="pointer-events-none absolute inset-0">{overlay}</div>

      {/* Double-tap: a wave */}
      {burst > 0 && (
        <span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="dp-wave-burst grid h-28 w-28 place-items-center rounded-full bg-white/25 text-[64px] backdrop-blur-sm" onAnimationEnd={() => setBurst(0)}>
            👋
          </span>
        </span>
      )}
      <style>{`@keyframes dp-wave-burst{0%{transform:scale(.4);opacity:0}25%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}.dp-wave-burst{animation:dp-wave-burst .9s ease-out both}`}</style>

      {/* Which photo you're on: top left, out of the way of the words at the bottom */}
      {slides > 1 && (
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur">
          {Array.from({ length: slides }, (_, i) => (
            <span key={i} className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-white" : "w-1.5 bg-white/55")} />
          ))}
        </div>
      )}
    </div>
  );
}
