"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Eye, Gamepad2, MessageCircle, Radar, UserRound, UsersRound } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { tapFeedback } from "@/components/ui/Button";

const KEY = "dp_tour_v1";

type Step = {
  /** The part of the page to light up (data-tour="…"); none for a centred card */
  target?: string;
  icon: React.ReactNode;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: <MaskIcon className="w-8" eyes="#5b3fd9" />,
    title: "Welcome to Dashpad",
    body: "Everyone here is masked. Chat, send voice notes and play games without showing your face. When you both unmask, you see each other's real photos.",
  },
  {
    target: "masquerade-card",
    icon: <Radar size={22} />,
    title: "Your Masquerade card",
    body: "Switch it on and you're paired the moment someone who fits is online. Once paired, tap the mic to send them a voice note. Tap your icons to change who you'd like to meet.",
  },
  {
    target: "recent",
    icon: <MessageCircle size={22} />,
    title: "Recent chats and notes",
    body: "Your latest chats, with the notes people have shared today. Tap Your note to share what's on your mind for 24 hours.",
  },
  {
    target: "views",
    icon: <Eye size={22} />,
    title: "Who viewed you",
    body: "See who looked at your profile this week. Wave at someone you like: if you both wave, a masked chat opens.",
  },
  {
    target: "people",
    icon: <UsersRound size={22} />,
    title: "People for you",
    body: "People who fit you, with how well you match. Swipe their photos, tap Hear me for their voice intro, tap the photo for their profile, or double-tap to wave. Break the ice to reply to one of their cards, ask a This or That, send a voice hello or challenge them to a game.",
  },
  {
    icon: <Gamepad2 size={22} />,
    title: "In your chats",
    body: "Tap + for games, gifts, stickers, icebreakers and Your Island (beta): a little town that grows with every message you two send. In masked chats your voice notes are disguised, unless you pick Normal to use your real voice.",
  },
  {
    icon: <UserRound size={22} />,
    title: "Your profile",
    body: "Add your Things about me cards and a short voice intro so people get a feel for you. Your photos stay masked until you both unmask, and you can hide your age too.",
  },
];

/** A short tour of Home the first time someone opens Dashpad (on this phone). */
export function WelcomeTour({ force, off }: { force?: boolean; off?: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  // Skipped: tucked away as a small button until it's finished
  const [later, setLater] = useState<number | null>(null);

  useEffect(() => {
    if (force) return setStep(0);
    if (off) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (saved === "1") return;
    if (saved?.startsWith("later:")) return setLater(Math.max(0, Math.min(STEPS.length - 1, Number(saved.slice(6)) || 0)));
    const t = setTimeout(() => setStep(0), 900);
    return () => clearTimeout(t);
  }, [force, off]);

  // Light up the part of the page this step is about
  useLayoutEffect(() => {
    if (step === null) return;
    const target = STEPS[step].target;
    const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
    if (!el) return setBox(null);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setBox(el.getBoundingClientRect());
    const t = setTimeout(measure, 380);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode */
    }
    setStep(null);
    setLater(null);
  }

  function skip() {
    const at = step ?? 0;
    try {
      localStorage.setItem(KEY, `later:${at}`);
    } catch {
      /* private mode */
    }
    setStep(null);
    setLater(at);
  }

  if (step === null && later !== null) {
    return createPortal(
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          setStep(later);
          setLater(null);
        }}
        className="fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[45] inline-flex h-11 animate-pop items-center gap-2 rounded-full bg-ink pr-4 pl-1.5 text-[13px] font-semibold text-white shadow-lift lg:bottom-6"
        aria-label="Finish the welcome tour"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand">
          <MaskIcon className="w-5" eyes="#5b3fd9" />
        </span>
        Finish the tour · {later + 1}/{STEPS.length}
      </button>,
      document.body,
    );
  }

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const lit = s.target && box;
  const pad = 8;
  // The card sits below what's lit up, or above it, or (for something tall) at the bottom of the screen
  const room = 230;
  const place = !lit ? "middle" : box.bottom + room < window.innerHeight ? "below" : box.top > room ? "above" : "bottom";

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Welcome tour">
      {lit ? (
        <div
          className="pointer-events-none absolute rounded-[28px] transition-all duration-300"
          style={{
            left: box.left - pad,
            top: box.top - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(20,14,40,0.72), 0 0 0 3px rgba(255,255,255,0.9), 0 0 30px 6px rgba(167,139,250,0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(20,14,40,0.72)] backdrop-blur-[2px] animate-fade-in" />
      )}

      <div
        key={step}
        className={clsx("absolute inset-x-4 mx-auto max-w-sm animate-fade-up", !lit && "top-1/2 -translate-y-1/2")}
        style={
          !lit
            ? undefined
            : place === "below"
              ? { top: box.bottom + pad + 14 }
              : place === "above"
                ? { bottom: window.innerHeight - box.top + pad + 14 }
                : { bottom: "calc(16px + env(safe-area-inset-bottom))" }
        }
      >
        <div className="rounded-[28px] bg-surface p-5 shadow-lift">
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold">{s.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {STEPS.map((_, k) => (
                <span key={k} className={clsx("h-1.5 rounded-full transition-all", k === step ? "w-5 bg-brand" : "w-1.5 bg-ink/15")} />
              ))}
            </div>
            {!last && (
              <button type="button" onClick={skip} className="h-10 px-2 text-[14px] font-semibold text-muted">
                Later
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                if (last) finish();
                else setStep(step + 1);
              }}
              className="h-10 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition active:scale-95"
            >
              {last ? "Let's go" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
