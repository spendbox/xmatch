"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { BellRing, Check, ChevronRight, Gift, MapPin, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NEEDED, type Thing } from "@/lib/things";
import { NotificationsPanel, usePushState } from "@/components/app/Notifications";
import { Sheet } from "@/components/ui/Sheet";
import { useInvites, useShareInvite } from "@/components/profile/InviteCard";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { Spinner, tapFeedback } from "@/components/ui/Button";
import { ThingsDeck } from "@/components/profile/ThingsDeck";

type Status = { place: boolean; push: boolean; things: number; claimed: boolean; reward: number };

/**
 * The setup checklist on Home, on its own card: where you are, notifications and
 * 10 things about you. Finishing earns Keys once (set in admin), then it goes away.
 */
export function GettingStarted({
  hasPlace,
  onPlace,
  things: initialThings,
  onKeys,
  demo,
}: {
  hasPlace: boolean;
  onPlace: () => void;
  things: Thing[];
  /** Keys were added (refresh the wallet) */
  onKeys?: () => void;
  demo?: Status;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<Status | null>(demo ?? null);
  const [things, setThings] = useState<Thing[]>(initialThings);
  const [deck, setDeck] = useState(false);
  const [pushHelpOpen, setPushHelpOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const push = usePushState();
  const invites = useInvites();
  const { share, copied } = useShareInvite(invites);

  useEffect(() => {
    if (demo) return;
    supabase.rpc("setup_status").then(({ data }) => data && setStatus(data as Status));
  }, [supabase, demo]);

  if (!status || (status.claimed && claimed === null)) return null;

  // Notifications count unless this phone can't do them
  const pushOk = push.state === "on" || status.push;
  // On iPhone, notifications need Dashpad on the home screen first: we show how
  const pushHelp = push.state === "needs-install" || push.state === "blocked" || push.state === "unsupported";
  const placeOk = hasPlace || status.place;
  const thingsOk = things.length >= NEEDED;
  const done = [placeOk, pushOk, thingsOk].filter(Boolean).length;
  const all = done === 3;
  const reward = status.reward;

  async function claim() {
    setClaiming(true);
    setError(null);
    tapFeedback();
    if (demo) {
      setClaiming(false);
      return setClaimed(reward);
    }
    const { data, error: err } = await supabase.rpc("claim_setup_reward", { p_no_push: false });
    setClaiming(false);
    if (err) return setError(keysError(err.message));
    setClaimed((data as { reward: number }).reward);
    onKeys?.();
  }

  if (claimed !== null) {
    return (
      <section className="mt-4 flex animate-pop items-center gap-3 rounded-3xl border border-gold/40 bg-gold-soft p-4">
        <KeyCoin size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-[#8a5a00]">+{claimed} Keys</p>
          <p className="text-[13px] text-[#8a5a00]/80">You&apos;re all set up. Enjoy!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Get set up</p>
          <p className="flex items-center gap-1 text-[13px] text-muted">
            Finish all {3} for <KeyCoin size={15} /> <b className="text-[#8a5a00]">{reward} Keys</b>
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-bold text-brand tabular-nums">{done}/3</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(done / 3) * 100}%` }} />
      </div>

      <ul className="mt-2 divide-y divide-line">
        <Row
          icon={<Sparkles size={17} />}
          done={thingsOk}
          title={`Tell us ${NEEDED} things about you`}
          sub={thingsOk ? `${things.length} added · used to find your people` : `${things.length}/${NEEDED} · helps us pair you with people you click with`}
          onClick={() => setDeck(true)}
        />
        <Row icon={<MapPin size={17} />} done={placeOk} title="Add where you are" sub="To be paired with people nearby" onClick={onPlace} />
        <Row
          icon={<BellRing size={17} />}
          done={pushOk}
          title={push.busy ? "Turning on…" : push.state === "needs-install" ? "Add Dashpad to your home screen" : "Turn on notifications"}
          sub={
            pushOk
              ? "You'll know when your pair arrives"
              : push.state === "needs-install"
                ? "iPhones need this before notifications can turn on · 3 quick steps"
                : push.state === "blocked"
                  ? "Blocked in your browser · tap to see how to allow them"
                  : "Know when your pair arrives"
          }
          onClick={pushOk ? undefined : pushHelp ? () => setPushHelpOpen(true) : () => void push.turnOn()}
        />
        <Row
          icon={<Gift size={17} />}
          bonus
          title={copied ? "Link copied!" : "Invite friends"}
          sub={`Bonus · ${invites?.reward ?? 10} Keys when they buy their first Keys`}
          onClick={share}
        />
      </ul>

      {error && <p className="mt-2 text-[13px] font-medium text-chili">{error}</p>}
      {all && (
        <button
          type="button"
          onClick={claim}
          disabled={claiming}
          className="mt-3 inline-flex h-12 w-full animate-pop items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ffd36b] to-gold text-[15px] font-bold text-ink shadow-[0_5px_0_#b9831e] transition active:translate-y-1 active:shadow-[0_1px_0_#b9831e] disabled:opacity-70"
        >
          {claiming ? <Spinner className="h-4 w-4" /> : <KeyCoin size={20} />} Claim {reward} Keys
        </button>
      )}

      <Sheet open={pushHelpOpen} onClose={() => setPushHelpOpen(false)} title="Turn on notifications" icon={<BellRing size={22} strokeWidth={1.75} />}>
        <NotificationsPanel push={push} />
      </Sheet>

      <ThingsDeck open={deck} onClose={() => setDeck(false)} things={things} onSaved={setThings} demo={!!demo} />
    </section>
  );
}

function Row({
  icon,
  done,
  skipped,
  bonus,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  done?: boolean;
  skipped?: boolean;
  bonus?: boolean;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className={clsx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          done ? "bg-mint text-white" : skipped ? "bg-ink/[0.06] text-muted" : bonus ? "bg-gold-soft text-[#9a6a0c]" : "bg-brand-soft text-brand",
        )}
      >
        {done || skipped ? <Check size={16} strokeWidth={3} /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block text-[14px] font-semibold", done && "text-muted line-through decoration-muted/50")}>{title}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
      {onClick && !done && <ChevronRight size={18} className="shrink-0 text-muted" />}
    </>
  );
  return (
    <li>
      {onClick && !done ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onClick();
          }}
          className="flex w-full items-center gap-3 py-2.5 text-left transition active:scale-[0.99]"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}
