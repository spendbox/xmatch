"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MAX_THINGS, NEEDED, promptOf, type Thing } from "@/lib/things";
import { tapFeedback } from "@/components/ui/Button";
import { ThingsDeck } from "./ThingsDeck";

/** Profile: your "things about me" cards. Tap one to change it, or add more. */
export function ThingsAboutMe({ initial }: { initial: Thing[] }) {
  const [things, setThings] = useState<Thing[]>(initial);
  const [deck, setDeck] = useState<{ edit: number | null } | null>(null);
  const left = NEEDED - things.length;

  return (
    <section className="mt-3 rounded-3xl border border-line bg-surface py-4 shadow-card">
      <div className="flex items-end justify-between gap-3 px-4">
        <div>
          <p className="text-[15px] font-semibold">Things about me</p>
          <p className="text-[13px] text-muted">
            {left > 0 ? `Add ${left} more to finish your ${NEEDED}` : `${things.length} · we use these to find your people`}
          </p>
        </div>
        {things.length < MAX_THINGS && (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setDeck({ edit: null });
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3.5 text-[13px] font-semibold text-brand"
          >
            <Plus size={15} /> Add
          </button>
        )}
      </div>

      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {things.map((t, i) => {
          const p = promptOf(t.p);
          return (
            <button
              key={`${t.p}-${i}`}
              type="button"
              onClick={() => {
                tapFeedback();
                setDeck({ edit: i });
              }}
              className="relative flex h-[118px] w-[148px] shrink-0 flex-col justify-between overflow-hidden rounded-[22px] p-3.5 text-left text-white transition active:scale-[0.97]"
              style={{ background: p.tone }}
              aria-label={`${p.text} ${t.a}. Tap to change`}
            >
              <span aria-hidden className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-white/10" />
              <span className="relative line-clamp-2 text-[12px] leading-tight font-semibold text-white/80">{p.text}</span>
              <span className="relative line-clamp-3 text-[16px] leading-snug font-bold">{t.a}</span>
            </button>
          );
        })}
        {things.length < MAX_THINGS && (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setDeck({ edit: null });
            }}
            className="flex h-[118px] w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-strong text-muted transition active:scale-[0.97]"
          >
            <Plus size={22} />
            <span className="text-[13px] font-semibold">{things.length ? "Add more" : "Add one"}</span>
          </button>
        )}
      </div>

      <ThingsDeck open={!!deck} edit={deck?.edit ?? null} onClose={() => setDeck(null)} things={things} onSaved={setThings} />
    </section>
  );
}
