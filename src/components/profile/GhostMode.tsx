"use client";

import { useMemo, useState } from "react";
import { Ghost } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/Toggle";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { usePrices } from "@/components/keys/usePrices";

/** Ghost mode: hide yourself from the Meet page. Paid for 30 days at a time. */
export function GhostMode({ on: initialOn, until: initialUntil }: { on: boolean; until: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const { ghost_cost: cost } = usePrices();
  const [until, setUntil] = useState(initialUntil);
  const paid = !!until && new Date(until).getTime() > Date.now();
  const [on, setOn] = useState(initialOn && paid);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(v: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("set_ghost", { p_on: v });
    setBusy(false);
    if (err) return setError(keysError(err.message));
    const r = data as { on: boolean; until: string | null };
    setOn(r.on);
    setUntil(r.until);
    setConfirm(false);
  }

  const endDate = until ? new Date(until).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

  return (
    <>
      <div className="mt-3 flex w-full items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-card">
        <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-[14px] " + (on ? "bg-ink text-white" : "bg-brand-soft text-brand")}>
          <Ghost size={20} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Ghost mode</span>
          <span className="block text-[13px] text-muted">
            {on ? `Hidden from Meet until ${endDate}` : paid ? `Off · paid until ${endDate}` : `Hide from Meet · ${cost} Keys for 30 days`}
          </span>
        </span>
        <Toggle
          checked={on}
          disabled={busy}
          label="Ghost mode"
          onChange={(v) => {
            if (v && !paid) return setConfirm(true);
            void set(v);
          }}
        />
      </div>
      {error && !confirm && <p className="mt-1.5 px-2 text-[13px] font-medium text-chili">{error}</p>}

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Go ghost?"
        subtitle="Nobody can find you on the Meet page or search for you there. Your chats, masked pairs and events work as usual."
        icon={<Ghost size={22} strokeWidth={1.75} />}
        footer={
          <div className="space-y-2">
            {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
            <Button size="lg" onClick={() => set(true)} loading={busy} loadingText="Going ghost…">
              Go ghost · <KeyCoin size={20} /> {cost}
            </Button>
          </div>
        }
      >
        <ul className="space-y-2 text-[14px] text-ink-soft">
          <li>Lasts 30 days. It doesn&apos;t renew by itself.</li>
          <li>Switch it off and on as often as you like during those 30 days, at no extra cost.</li>
        </ul>
      </Sheet>
    </>
  );
}
