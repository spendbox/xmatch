"use client";

import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/scrollLock";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** A pop-up panel that slides up from the bottom of the screen. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  layer = "z-50",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Stacking: games sit above the app, so a sheet opened from a game goes higher */
  layer?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const unlock = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 ${layer} flex items-end justify-center sm:items-center sm:p-6`} role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 animate-fade-in bg-ink/40" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-md animate-sheet-up overflow-y-auto rounded-t-[32px] bg-surface px-5 pt-3 pb-safe shadow-lift sm:max-w-lg sm:animate-pop sm:rounded-[32px] sm:px-7 sm:pt-7 sm:pb-6">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start gap-3.5">
          {icon && <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] leading-tight font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-[14px] leading-snug text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mt-1 -mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {/* The main button stays in view, however long the content is */}
        {footer && <div className="sticky bottom-0 z-10 -mx-5 mt-3 bg-surface px-5 pt-3 pb-2 shadow-[0_-12px_16px_-12px_rgb(28_24_40/0.12)] sm:-mx-7 sm:px-7">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
