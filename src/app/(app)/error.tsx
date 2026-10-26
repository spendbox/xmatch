"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/** Instead of a blank "Application error" page: say so, report it, and let them carry on */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, "page"), [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-8 text-center">
      <p className="font-display text-[28px] leading-tight font-semibold text-ink">Something went wrong</p>
      <p className="mt-2 max-w-[300px] text-[15px] text-muted">We&apos;ve been told about it. Try again, or head back home.</p>
      <div className="mt-7 flex w-full max-w-[300px] flex-col gap-2.5">
        <button type="button" onClick={reset} className="h-13 rounded-2xl bg-brand py-3.5 text-[16px] font-bold text-white">
          Try again
        </button>
        <a href="/home" className="h-13 rounded-2xl border border-line py-3.5 text-[16px] font-bold text-ink">
          Go home
        </a>
      </div>
    </div>
  );
}
