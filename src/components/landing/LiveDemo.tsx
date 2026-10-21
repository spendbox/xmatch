"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Heart, MessageCircleQuestion } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { InterestIcon } from "@/components/ui/icons";

type Line = { who: "them" | "me"; text: string } | { who: "q"; text: string } | { who: "typing" };

// What the little demo chat shows, one step at a time
const SCRIPT: Line[] = [
  { who: "q", text: "What's your idea of a perfect first date?" },
  { who: "typing" },
  { who: "them", text: "Street food, then a long walk with no plan 😄" },
  { who: "me", text: "Okay that's literally my dream date" },
  { who: "typing" },
  { who: "them", text: "Wait… you're into Afrobeats too?" },
  { who: "me", text: "Since day one 🔥" },
];
const STEP_MS = 1500;
const END = SCRIPT.length + 3; // + countdown, unmask, match

export function LiveDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (END + 2)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const shown = SCRIPT.slice(0, Math.min(step + 1, SCRIPT.length)).filter(
    (l, i, arr) => l.who !== "typing" || i === arr.length - 1,
  );
  const deciding = step >= SCRIPT.length && step < SCRIPT.length + 2;
  const matched = step >= SCRIPT.length + 2;
  const seconds = Math.max(0, 300 - Math.round((step / SCRIPT.length) * 300));
  const timer = matched || deciding ? "0:00" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div aria-hidden className="absolute -inset-4 rounded-[44px] bg-gradient-to-br from-brand/25 via-[#ff8fb8]/20 to-gold/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-surface/90 shadow-[0_30px_60px_-20px_rgb(28_24_40/0.35)] backdrop-blur">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span
            className={clsx(
              "grid h-10 w-10 place-items-center rounded-full transition-all duration-700",
              matched ? "bg-gradient-to-br from-[#ff8fb8] to-gold" : "bg-ink",
            )}
          >
            {matched ? <span className="text-sm font-bold text-white">A</span> : <MaskIcon className="w-6 text-white" eyes="#1c1828" />}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[14px] font-semibold">{matched ? "Ada, 26" : "Velvet Owl"}</p>
            <p className="text-[12px] text-muted">{matched ? "Unmasked just now" : "3 km away · Dating"}</p>
          </div>
          <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums", deciding ? "bg-chili-soft text-chili" : "bg-cream text-ink")}>
            {timer}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-hidden px-4 py-2.5">
          {["Music", "Travel", "Food"].map((t) => (
            <span key={t} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">
              <InterestIcon name={t} size={12} /> {t}
            </span>
          ))}
          <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-muted">3 shared vibes</span>
        </div>

        {/* Messages */}
        <div className="relative flex h-[300px] flex-col justify-end gap-2 overflow-hidden px-4 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_14%)]">
          {shown.map((l, i) => {
            if (l.who === "q")
              return (
                <div key={i} className="mx-auto mb-1 max-w-[92%] animate-fade-up rounded-2xl border border-gold/40 bg-gold-soft px-3 py-2 text-center">
                  <p className="flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide text-[#9a6a0c] uppercase">
                    <MessageCircleQuestion size={11} /> Icebreaker
                  </p>
                  <p className="text-[13px] font-medium">{l.text}</p>
                </div>
              );
            if (l.who === "typing")
              return (
                <div key={i} className="flex w-fit animate-fade-up gap-1 rounded-2xl rounded-bl-md bg-cream px-3.5 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-typing rounded-full bg-muted" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              );
            return (
              <p
                key={i}
                className={clsx(
                  "max-w-[80%] animate-fade-up px-3.5 py-2 text-left text-[13px] leading-snug",
                  l.who === "me" ? "self-end rounded-2xl rounded-br-md bg-brand text-white" : "rounded-2xl rounded-bl-md bg-cream text-ink",
                )}
              >
                {l.text}
              </p>
            );
          })}

          {/* Decision + match overlays */}
          {(deciding || matched) && (
            <div className="absolute inset-0 grid animate-fade-in place-items-center bg-surface/80 backdrop-blur-[2px]">
              {matched ? (
                <div className="animate-pop text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-chili-soft text-chili">
                    <Heart size={30} fill="currentColor" />
                  </span>
                  <p className="mt-3 font-display text-[24px] font-semibold">It&apos;s a vibe!</p>
                  <p className="text-[13px] text-muted">You both unmasked</p>
                </div>
              ) : (
                <div className="animate-pop text-center">
                  <p className="font-display text-[22px] font-semibold">Time&apos;s up</p>
                  <p className="text-[13px] text-muted">Unmask?</p>
                  <div className="mt-3 flex justify-center gap-3">
                    {["You", "Them"].map((w, i) => (
                      <span key={w} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-muted">
                        <span
                          className={clsx(
                            "grid h-11 w-11 place-items-center rounded-full transition-all duration-500",
                            step >= SCRIPT.length + i ? "bg-mint text-white" : "bg-line text-muted",
                          )}
                        >
                          {step >= SCRIPT.length + i ? <Check size={20} strokeWidth={3} /> : <MaskIcon className="w-6" eyes="#ebe5dc" />}
                        </span>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
