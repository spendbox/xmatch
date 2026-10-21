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
  return (
    <div className="flex flex-wrap gap-2">
      {INTEREST_OPTIONS.map((tag) => {
        const on = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            aria-pressed={on}
            className={clsx(
              "inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-3 text-[14px] font-medium transition active:scale-95",
              on ? "animate-pop border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/20",
            )}
          >
            <InterestIcon name={tag} size={17} />
            {tag}
          </button>
        );
      })}
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
