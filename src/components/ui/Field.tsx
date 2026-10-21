import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-ink-soft">
      {children}
    </label>
  );
}

export const inputClass =
  "h-13 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-muted/70 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={clsx(
        "w-full resize-none rounded-2xl border border-line-strong bg-surface p-4 text-[16px] leading-relaxed text-ink placeholder:text-muted/70 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10",
        className,
      )}
      {...props}
    />
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-chili-soft px-4 py-3 text-sm font-medium text-chili">
      {message}
    </p>
  );
}
