"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, History, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { intentLabel } from "@/lib/constants";
import { sexLabel } from "@/lib/eventSpace";
import { REOPEN_COST } from "@/lib/keys";
import { whenPaired, type PastPair } from "@/lib/hourly";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { MaskAvatar } from "@/components/feed/MaskAvatar";

/** Pairs whose hour ended before you both decided. Open one to read it, unmask, or reopen it with Keys. */
export function PastPairs({ pairs, balance, onChanged }: { pairs: PastPair[]; balance: number | null; onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [pick, setPick] = useState<PastPair | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!pairs.length) return null;
  const now = Date.now();

  async function reopen(p: PastPair) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("reopen_masquerade", { p_session: p.id });
    setBusy(false);
    if (err) return setError(keysError(err.message));
    notify({ kind: "masquerade_reopen", sessionId: p.id });
    onChanged?.();
    router.push(`/masquerade/${p.id}`);
  }

  return (
    <section className="mt-7 lg:mt-0 lg:mb-7">
      <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
        <History size={16} className="text-brand" /> Past pairs
      </h2>
      <p className="mb-3 text-[13px] text-muted">The hour ran out before you both decided. Unmask any time, or reopen the chat.</p>
      <ul className="space-y-2.5">
        {pairs.map((p) => {
          const open = p.status === "active";
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3 shadow-card">
              <Link href={`/masquerade/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <MaskAvatar alias={p.their_alias} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {p.their_alias}
                    <span className="font-normal text-muted">{[p.their_age, sexLabel(p.their_gender)].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                  </span>
                  <span className="block truncate text-[13px] text-muted">{p.last_message ?? "No messages"}</span>
                  <span className="block truncate text-[11px] font-medium text-brand">
                    {intentLabel(p.intent)} · {whenPaired(p.hour_at, now)}
                    {p.my_vote ? " · you unmasked" : ""}
                  </span>
                </span>
              </Link>
              {open ? (
                <Link href={`/masquerade/${p.id}`} className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-brand px-3 text-[12px] font-semibold text-white">
                  Open <ChevronRight size={14} />
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    setPick(p);
                  }}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-gold/50 bg-gold-soft px-3 text-[12px] font-semibold text-[#8a5a00]"
                >
                  <RotateCcw size={13} /> <KeyCoin size={14} /> {REOPEN_COST}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Sheet
        open={!!pick}
        onClose={() => setPick(null)}
        title={`Reopen your chat with ${pick?.their_alias ?? "them"}?`}
        subtitle="You both stay masked. The chat stays open until you both decide to unmask or let go."
        icon={<RotateCcw size={22} />}
        footer={
          <div className="space-y-2">
            {error && <p className="rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
            {balance !== null && balance < REOPEN_COST ? (
              <Link href="/wallet" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-ink">
                <KeyCoin size={22} /> Get Keys
              </Link>
            ) : (
              <Button size="lg" onClick={() => pick && reopen(pick)} loading={busy} loadingText="Reopening…">
                Reopen · <KeyCoin size={20} /> {REOPEN_COST}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex items-center justify-between rounded-2xl bg-gold-soft px-4 py-3">
          <span className="text-[14px] font-medium text-[#8a5a00]">Your balance</span>
          <span className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#8a5a00]">
            <KeyCoin size={20} /> {balance ?? "…"}
          </span>
        </div>
      </Sheet>
    </section>
  );
}
