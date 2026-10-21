"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

type Option<T> = { value: T; label: ReactNode; hint?: ReactNode; icon?: ReactNode };

/**
 * A set of tappable cards. Each option gets its own equal-size cell,
 * so labels never squeeze or overlap on small screens.
 */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 3,
  name,
  size = "md",
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={clsx("grid gap-2", {
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
            onClick={() => onChange(o.value)}
            className={clsx(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center transition",
              size === "md" ? "py-3" : "py-2.5",
              active
                ? "border-brand bg-brand-soft text-brand-ink ring-1 ring-brand"
                : "border-line bg-surface text-ink-soft hover:border-line-strong",
            )}
          >
            {o.icon ? <span className="text-lg leading-none">{o.icon}</span> : null}
            <span className="text-[14px] font-semibold leading-tight">{o.label}</span>
            {o.hint ? <span className="text-[11px] leading-tight text-muted">{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
