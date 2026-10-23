"use client";

import clsx from "clsx";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { haptic } from "@/lib/haptics";

type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger";
type Size = "md" | "lg";

const base =
  "group relative isolate inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-2xl font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 aria-busy:pointer-events-none";
const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_24px_-6px_rgb(91_63_217/0.55)] hover:bg-brand-dark active:shadow-[0_4px_12px_-4px_rgb(91_63_217/0.5)]",
  gold: "bg-gold text-ink shadow-[0_8px_24px_-6px_rgb(242_179_61/0.6)] hover:brightness-[0.97]",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-cream active:bg-line/60",
  ghost: "text-ink-soft hover:bg-ink/5 active:bg-ink/10",
  danger: "bg-chili-soft text-chili hover:bg-chili/15",
};
const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 w-full px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

/** Moving light across the button while it's working. */
function Shimmer() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <span className="absolute inset-y-0 -left-1/2 w-[200%] animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </span>
  );
}

function Content({ loading, loadingText, children }: { loading?: boolean; loadingText?: ReactNode; children: ReactNode }) {
  return (
    <>
      {loading && <Shimmer />}
      {loading ? (
        <>
          <Spinner />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  loadingText,
  children,
  onClick,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean; loadingText?: ReactNode }) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      aria-busy={loading || undefined}
      disabled={props.disabled}
      onClick={(e) => {
        tapFeedback();
        onClick?.(e);
      }}
      {...props}
    >
      <Content loading={loading} loadingText={loadingText}>
        {children}
      </Content>
    </button>
  );
}

/** A submit button that shows it's working while its form is being sent. */
export function SubmitButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button type="submit" {...props} loading={pending || props.loading} />;
}

function LinkPending({ children, loadingText }: { children: ReactNode; loadingText?: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <Content loading={pending} loadingText={loadingText}>
      {children}
    </Content>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  loadingText,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; loadingText?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} onClick={tapFeedback} {...props}>
      <LinkPending loadingText={loadingText}>{children}</LinkPending>
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-[18px] w-[18px] animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A tiny buzz on phones that support it. */
export function tapFeedback() {
  haptic(8);
}
