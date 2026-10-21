"use client";

import { Button, Spinner } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { MasqueradeState } from "@/lib/types";

export function DecisionSheet({
  state,
  voting,
  onVote,
}: {
  state: MasqueradeState;
  voting: boolean;
  onVote: (unmask: boolean) => void;
}) {
  const waiting = state.me.vote === true;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-[32px] bg-surface px-6 pt-7 pb-safe text-center shadow-lift animate-fade-up sm:rounded-[32px] sm:p-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white">
          <MaskIcon className="w-10" eyes="#5b3fd9" />
        </span>

        {waiting ? (
          <>
            <h2 className="mt-5 font-display text-[26px] leading-tight font-semibold">You chose to unmask</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
              Waiting for {state.them.alias} to decide…
            </p>
            <div className="mt-6 mb-4 flex items-center justify-center gap-2 text-[14px] font-medium text-brand">
              <Spinner /> {state.them.has_voted ? "Revealing…" : "Hold tight"}
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-5 font-display text-[26px] leading-tight font-semibold">Time&apos;s up!</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
              Want to see who {state.them.alias} really is? If you both unmask, it&apos;s a match. If not, this chat
              is deleted.
            </p>
            <div className="mt-6 space-y-3">
              <Button size="lg" onClick={() => onVote(true)} loading={voting}>
                Unmask
              </Button>
              <Button size="lg" variant="secondary" onClick={() => onVote(false)} disabled={voting}>
                Stay masked
              </Button>
            </div>
            <p className="mt-4 mb-2 text-[12px] text-muted">They won&apos;t see your choice unless you both unmask.</p>
          </>
        )}
      </div>
    </div>
  );
}
