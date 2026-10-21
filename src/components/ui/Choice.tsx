"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { tapFeedback } from "./Button";

type Option<T> = { value: T; label: ReactNode; hint?: ReactNode; icon?: ReactNode };

/**
 * Tappable option cards. Each option gets its own equal-size cell,
 * so labels never squeeze or overlap on small screens.
 */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 3,
  name,
  layout = "stack",
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
  name: string;
  /** stack = icon above text, row = icon beside text */
  layout?: "stack" | "row";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={clsx("grid gap-2.5", {
        "grid-cols-1": columns === 1,
        "grid-cols-2": columns === 2,
        "grid-cols-3": columns === 3,
        "grid-cols-4": columns === 4,
      })}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              tapFeedback();
              onChange(o.value);
            }}
            className={clsx(
              "relative flex rounded-2xl border transition duration-200 active:scale-[0.97]",
              layout === "stack" ? "min-h-[92px] flex-col items-center justify-center gap-2 px-2 py-3 text-center" : "items-center gap-3.5 p-3.5 text-left",
              active
                ? "border-brand bg-brand-soft/70 shadow-[0_6px_18px_-8px_rgb(91_63_217/0.45)]"
                : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {o.icon ? (
              <span
                key={active ? "on" : "off"}
                className={clsx(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] transition",
                  active ? "animate-pop bg-brand text-white" : "bg-cream text-ink-soft",
                )}
              >
                {o.icon}
              </span>
            ) : null}
            <span className={clsx("min-w-0", layout === "row" && "flex-1")}>
              <span className={clsx("block text-[14px] leading-tight font-semibold", active ? "text-brand-ink" : "text-ink")}>
                {o.label}
              </span>
              {o.hint ? <span className="mt-0.5 block text-[12px] leading-snug text-muted">{o.hint}</span> : null}
            </span>
            {active && (
              <span className="absolute top-2 right-2 grid h-5 w-5 animate-pop place-items-center rounded-full bg-brand text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
