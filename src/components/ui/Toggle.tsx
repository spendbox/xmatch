"use client";

import clsx from "clsx";

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-brand" : "bg-[#cfe2fb]",
      )}
    >
      <span
        className={clsx(
          "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}
