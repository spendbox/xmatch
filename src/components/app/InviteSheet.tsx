"use client";

import { useEffect, useState } from "react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Button } from "@/components/ui/Button";
import { Chilis } from "@/components/ui/Spice";
import { intentLabel, spiceLabel } from "@/lib/constants";
import { MapPin } from "lucide-react";
import type { Invite } from "./InviteListener";

export function InviteSheet({
  invite,
  busy,
  needsKeys,
  onAccept,
  onDecline,
  onExpire,
}: {
  invite: Invite;
  busy?: boolean;
  needsKeys?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(invite.expires_at));

  useEffect(() => {
    const t = setInterval(() => {
      const s = secondsLeft(invite.expires_at);
      setLeft(s);
      if (s <= 0) onExpire();
    }, 500);
    return () => clearInterval(t);
  }, [invite.expires_at, onExpire]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-3xl bg-surface p-6 pb-safe shadow-lift animate-fade-up sm:rounded-3xl">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <MaskIcon className="w-9" eyes="#5b3fd9" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand">Masquerade invite</p>
            <h2 className="text-xl font-semibold leading-snug">Someone masked wants to chat</h2>
            {invite.distance_km !== null && invite.distance_km !== undefined && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[14px] text-muted">
                <MapPin size={14} /> {invite.distance_km <= 1 ? "Under 1 km" : `${invite.distance_km} km`} away
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Age" value={String(invite.from_age)} />
          <Stat label="Here for" value={intentLabel(invite.intent)} />
          <Stat label="Spice" value={<Chilis level={invite.spice} />} sub={spiceLabel(invite.spice)} />
        </dl>

        {needsKeys && (
          <p className="mt-4 rounded-2xl bg-gold-soft px-4 py-3 text-[13px] font-medium text-[#8a5a00]">
            You&apos;ve used today&apos;s 5 free masquerades. Join this one for 5 Keys?
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="h-14 flex-1" onClick={onDecline}>
            Not now
          </Button>
          <Button variant="primary" className="h-14 flex-[1.4]" onClick={onAccept} loading={busy}>
            {needsKeys ? `Join for 5 Keys · ${Math.max(0, left)}s` : `Join · ${Math.max(0, left)}s`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-cream px-2 py-3">
      <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold leading-tight">{value}</dd>
      {sub && <dd className="text-[11px] text-muted">{sub}</dd>}
    </div>
  );
}

function secondsLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 1000);
}
