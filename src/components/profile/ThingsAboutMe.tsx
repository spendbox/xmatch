"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MAX_THINGS, NEEDED, type Thing } from "@/lib/things";
import { tapFeedback } from "@/components/ui/Button";
import { ThingsDeck } from "./ThingsDeck";
import { ThingsStack } from "./ThingsStack";

/** Profile: your "things about me" as a deck. Tap it to flip through, change one, or add more. */
export function ThingsAboutMe({ initial }: { initial: Thing[] }) {
  const [things, setThings] = useState<Thing[]>(initial);
  const [deck, setDeck] = useState<{ edit: number | null } | null>(null);
  const left = NEEDED - things.length;
  const canAdd = things.length < MAX_THINGS;
  const add = () => {
    tapFeedback();
    setDeck({ edit: null });
  };

  return (
    <section className="mt-3 rounded-3xl border border-line bg-surface py-4 shadow-card">
      <div className="flex items-end justify-between gap-3 px-4">
        <div>
          <p className="text-[15px] font-semibold">Things about me</p>
          <p className="text-[13px] text-muted">
            {left > 0 ? `Add ${left} more to finish your ${NEEDED}` : `${things.length} · we use these to find your people`}
          </p>
        </div>
        {canAdd && (
          <button type="button" onClick={add} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3.5 text-[13px] font-semibold text-brand">
            <Plus size={15} /> Add
          </button>
        )}
      </div>

      <div className="px-4">
        {things.length > 0 ? (
          <ThingsStack
            things={things}
            title="Things about me"
            onEdit={(i) => setDeck({ edit: i })}
            onAdd={canAdd ? () => setDeck({ edit: null }) : undefined}
            addLabel="Add more"
          />
        ) : (
          <button
            type="button"
            onClick={add}
            className="mx-auto mt-3 flex aspect-[4/3.1] w-full max-w-[300px] flex-col items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-line-strong text-muted transition active:scale-[0.98]"
          >
            <Plus size={26} />
            <span className="text-[14px] font-semibold">Start your deck</span>
            <span className="text-[12px]">Finish a few cards like &ldquo;My comfort food is…&rdquo;</span>
          </button>
        )}
      </div>

      <ThingsDeck open={!!deck} edit={deck?.edit ?? null} onClose={() => setDeck(null)} things={things} onSaved={setThings} />
    </section>
  );
}
