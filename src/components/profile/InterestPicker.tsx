"use client";

import clsx from "clsx";
import { INTEREST_OPTIONS } from "@/lib/constants";

export const MAX_INTERESTS = 8;

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(tag: string) {
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
              "h-10 rounded-full border px-4 text-[14px] font-medium transition",
              on ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft",
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
