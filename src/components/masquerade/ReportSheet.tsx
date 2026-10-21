"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";

const REASONS = ["Rude or abusive", "Sexual content I didn't want", "Spam or scam", "Seems underage", "Something else"];

export function ReportSheet({ onClose, onReport }: { onClose: () => void; onReport: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[32px] bg-surface px-6 pt-6 pb-safe shadow-lift animate-fade-up sm:rounded-[32px] sm:p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">Report this person</h2>
        <p className="mt-1 text-[14px] text-muted">The chat will end and you won&apos;t be matched again. They won&apos;t know it was you.</p>
        <div className="mt-5 space-y-2">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className={clsx("w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition",
                reason === r ? "border-chili bg-chili-soft text-chili" : "border-line")}>
              {r}
            </button>
          ))}
        </div>
        <div className="mt-5 mb-2 flex gap-3">
          <Button variant="secondary" className="h-13 flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="h-13 flex-1" disabled={!reason} loading={busy}
            onClick={async () => { if (!reason) return; setBusy(true); await onReport(reason); setBusy(false); }}>
            Report
          </Button>
        </div>
      </div>
    </div>
  );
}
