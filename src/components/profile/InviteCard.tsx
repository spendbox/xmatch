"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Gift, Share2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";

export type MyInvites = {
  code: string;
  reward: number;
  joined: number;
  bought: number;
  earned: number;
  friends: { n: number; joined_at: string; purchases: number; earned: number }[];
};

let cache: Promise<MyInvites | null> | null = null;
/** Your invite link and how it's doing (made on first use). */
export function useInvites() {
  const [inv, setInv] = useState<MyInvites | null>(null);
  useEffect(() => {
    cache ??= Promise.resolve(createClient().rpc("my_invites")).then(({ data }) => (data as MyInvites | null) ?? null);
    cache.then(setInv).catch(() => {});
  }, []);
  return inv;
}

export const inviteUrl = (code: string) => `${typeof window !== "undefined" ? window.location.origin : "https://dashpad.site"}/i/${code}`;

/** Share (on phones) or copy the invite link. */
export function useShareInvite(inv: MyInvites | null) {
  const [copied, setCopied] = useState(false);
  const share = useCallback(async () => {
    if (!inv) return;
    tapFeedback();
    const url = inviteUrl(inv.code);
    const text = "Come meet people on Dashpad. A new masked chat every hour, and you only unmask if you both want to.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Dashpad", text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [inv]);
  return { share, copied };
}

/** On Profile: your link, what you've earned, and your invites (anonymous). */
export function InviteCard() {
  const inv = useInvites();
  const { share, copied } = useShareInvite(inv);
  const [justCopied, setJustCopied] = useState(false);
  const url = useMemo(() => (inv ? inviteUrl(inv.code) : ""), [inv]);

  return (
    <section className="mt-3 rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-[#a26b00]">
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Invite friends</p>
          <p className="text-[13px] leading-snug text-muted">
            Earn <span className="font-semibold text-ink">{inv?.reward ?? 10} Keys</span> when a friend you invite makes their first purchase.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cream p-1.5 pl-3.5">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-soft">{inv ? url.replace(/^https?:\/\//, "") : "Getting your link…"}</span>
        <button
          type="button"
          disabled={!inv}
          onClick={async () => {
            if (!inv) return;
            tapFeedback();
            try {
              await navigator.clipboard.writeText(url);
              setJustCopied(true);
              setTimeout(() => setJustCopied(false), 2000);
            } catch {}
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-soft shadow-card"
          aria-label="Copy link"
        >
          {justCopied ? <Check size={16} className="text-mint" /> : <Copy size={16} />}
        </button>
        <button
          type="button"
          disabled={!inv}
          onClick={share}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-[13px] font-semibold text-white"
        >
          <Share2 size={15} /> {copied ? "Copied" : "Share"}
        </button>
      </div>

      {inv && (
        <>
          <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line text-center">
            <Num value={inv.joined} label="joined" />
            <Num value={inv.bought} label="bought Keys" />
            <Num value={inv.earned} label="Keys earned" keys />
          </div>
          {inv.friends.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {inv.friends.slice(0, 20).map((f) => (
                <li key={f.n} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-[13px]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Users size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">Friend {f.n}</span>
                    <span className="text-muted">
                      {" "}
                      · joined {new Date(f.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {f.purchases ? " · bought Keys" : " · hasn't bought yet"}
                    </span>
                  </span>
                  {f.earned > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#8a5a00]">
                      +{f.earned} <KeyCoin size={14} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted">Invites are private. You never see who joined, and they never see it was you.</p>
        </>
      )}
    </section>
  );
}

function Num({ value, label, keys }: { value: number; label: string; keys?: boolean }) {
  return (
    <div className="px-1 py-2.5">
      <p className="inline-flex items-center gap-1 font-display text-[20px] leading-tight font-semibold text-brand">
        {value}
        {keys && <KeyCoin size={15} />}
      </p>
      <p className="truncate text-[11px] text-muted">{label}</p>
    </div>
  );
}
