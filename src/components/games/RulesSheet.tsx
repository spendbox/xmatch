"use client";

import { useEffect } from "react";
import { CircleHelp, X } from "lucide-react";
import { gameInfo, sfx, type GameKind } from "@/lib/games";
import { RULES } from "@/lib/gameRules";

/** The "Rules" button: opens how to play the game */
export function RulesButton({ onOpen, label = false }: { onOpen: () => void; label?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        sfx("tap");
        onOpen();
      }}
      aria-label="How to play"
      className={
        label
          ? "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white/12 px-5 text-[14px] font-bold ring-1 ring-white/15 active:scale-95"
          : "inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full bg-white/12 px-2.5 text-[12.5px] font-extrabold active:scale-95"
      }
    >
      <CircleHelp size={label ? 18 : 19} />
      {label ? "How to play" : <span className="hidden min-[360px]:inline">Rules</span>}
    </button>
  );
}

/** How to play, in plain words, over the game (the game keeps going underneath) */
export function RulesSheet({ kind, open, onClose }: { kind: GameKind; open: boolean; onClose: () => void }) {
  const rules = RULES[kind];
  const info = gameInfo(kind);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  if (!open || !rules) return null;
  return (
    <div className="absolute inset-0 z-[80] flex items-end bg-black/60 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={`How to play ${info.title}`}>
      <div
        className="flex max-h-[88%] w-full flex-col rounded-t-[28px] bg-[#fffaf0] text-left text-ink shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#9a6a12] uppercase">How to play</p>
            <h2 className="mt-0.5 font-display text-[28px] leading-tight font-bold">{info.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close rules" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <p className="rounded-2xl bg-gold/25 px-4 py-3 text-[15px] leading-snug font-bold">🏆 {rules.goal}</p>
          {rules.sections.map((s) => (
            <section key={s.title} className="mt-5">
              <h3 className="text-[16px] font-extrabold">{s.title}</h3>
              <ul className="mt-2 grid gap-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink/85">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27a32]" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-2xl bg-ink text-[16px] font-bold text-white">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
