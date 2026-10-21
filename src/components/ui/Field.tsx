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

/** Input with an icon on the left (and optional content on the right). */
export function IconInput({
  icon,
  right,
  className,
  ...props
}: ComponentProps<"input"> & { icon: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-muted">{icon}</span>
      <input className={clsx(inputClass, "h-14 pl-12", right ? "pr-12" : "", className)} {...props} />
      {right && <span className="absolute inset-y-0 right-0 grid w-12 place-items-center">{right}</span>}
    </div>
  );
}

/** A large, tappable checkbox row. */
export function CheckRow({ name, children, defaultChecked }: { name: string; children: ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-1 text-[14px] leading-snug text-ink-soft">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} required className="peer sr-only" />
      <span className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] border-2 border-line-strong bg-surface text-transparent transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}
