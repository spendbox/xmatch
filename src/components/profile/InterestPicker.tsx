"use client";

import clsx from "clsx";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { InterestIcon } from "@/components/ui/icons";
import { tapFeedback } from "@/components/ui/Button";

export const MAX_INTERESTS = 8;

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(tag: string) {
    tapFeedback();
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else if (value.length < MAX_INTERESTS) onChange([...value, tag]);
  }
  const full = value.length >= MAX_INTERESTS;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((tag) => {
          const on = value.includes(tag);
          const locked = full && !on;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={on}
              disabled={locked}
              className={clsx(
                "inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-3 text-[14px] font-medium transition duration-300 active:scale-95",
                on && "animate-pop border-brand bg-brand text-white",
                !on && !locked && "border-line-strong bg-surface text-ink-soft hover:border-ink/20",
                locked && "cursor-not-allowed border-line bg-surface text-ink-soft opacity-40 blur-[1.5px]",
              )}
            >
              <InterestIcon name={tag} size={17} />
              {tag}
            </button>
          );
        })}
      </div>
      {full && (
        <p className="mt-3 animate-fade-in text-[13px] font-medium text-brand">
          That&apos;s {MAX_INTERESTS} — the max. Tap one you picked to swap it out.
        </p>
      )}
    </div>
  );
}

export function InterestTag({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold whitespace-nowrap",
        highlight ? "bg-brand text-white" : "bg-cream text-ink-soft",
      )}
    >
      <InterestIcon name={name} size={14} />
      {name}
    </span>
  );
}
