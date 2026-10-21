"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Check, Users } from "lucide-react";
import { countdown, eventPhase, eventWhen, themeBg, type DashpadEvent } from "@/lib/events";
import { intentLabel } from "@/lib/constants";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";

export function useNow(every = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

export function EventCard({ event: e, compact }: { event: DashpadEvent; compact?: boolean }) {
  const now = useNow();
  const phase = now ? eventPhase(e, now) : "upcoming";
  const startsIn = now ? new Date(e.starts_at).getTime() - now : 0;
  return (
    <Link
      href={`/events/${e.id}`}
      className={clsx("group block overflow-hidden rounded-[28px] bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99]", phase === "ended" && "opacity-75")}
    >
      <div className={clsx("relative bg-gradient-to-br text-white", themeBg(e.theme), compact ? "p-5" : "p-6")}>
        <span aria-hidden className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">
            <CalendarDays size={13} /> Masquerade Night
          </span>
          <PhaseBadge phase={phase} startsIn={startsIn} />
        </div>
        <MaskIcon className={clsx("absolute right-5 bottom-4 text-white/20", compact ? "w-16" : "w-20")} eyes="transparent" />
        <p className={clsx("relative mt-4 font-display leading-tight font-semibold", compact ? "text-[22px]" : "text-[26px]")}>{e.title}</p>
        <p className="relative mt-1 text-[14px] text-white/85">{now ? eventWhen(e.starts_at, e.ends_at) : " "}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4 text-[12px] font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1">{INTENT_ICONS[e.intent]({ size: 13 })} {intentLabel(e.intent)}</span>
        <span className="rounded-full bg-cream px-2.5 py-1">Ages {e.age_min}–{e.age_max}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1"><Users size={13} /> {e.going_count} going</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[#8a5a00]">
          {e.entry_keys > 0 ? <><KeyCoin size={13} /> {e.entry_keys}</> : "Free"}
        </span>
        {e.i_am_going && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-white"><Check size={13} strokeWidth={3} /> Going</span>
        )}
      </div>
    </Link>
  );
}

export function PhaseBadge({ phase, startsIn }: { phase: string; startsIn: number }) {
  if (phase === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-chili uppercase">
        <span className="h-2 w-2 animate-pulse rounded-full bg-chili" /> Live now
      </span>
    );
  if (phase === "upcoming") return <span className="rounded-full bg-black/20 px-2.5 py-1 text-[12px] font-bold tabular-nums">Starts in {countdown(startsIn)}</span>;
  if (phase === "cancelled") return <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold uppercase">Cancelled</span>;
  return <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase">Ended</span>;
}
