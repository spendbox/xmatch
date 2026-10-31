"use client";

import { plural, word } from "@/lib/plural";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, KeyRound, MessageCircleQuestion, Music, Plus, Star, Users } from "lucide-react";
import { EVENT_KINDS, eventPhase, eventWhen, themeBg, type EventKind, type EventSettings } from "@/lib/events";
import { intentLabel } from "@/lib/constants";
import type { Intent } from "@/lib/types";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { AdminTitle } from "./AdminShell";

export type AdminNight = {
  id: string;
  title: string;
  description: string;
  theme: string;
  intent: Intent;
  // Optional so older rows still work (missing = masquerade, no cover)
  kind?: EventKind;
  cover_url?: string | null;
  stream_url?: string | null;
  settings?: EventSettings | null;
  starts_at: string;
  ends_at: string;
  age_min: number;
  age_max: number;
  entry_keys: number;
  max_attendees: number | null;
  status: "draft" | "published" | "cancelled";
  going_count: number;
  rounds: number;
  unmasks: number;
  keys_collected: number;
  question_count: number;
};

const BADGE: Record<string, string> = {
  draft: "bg-cream text-ink-soft",
  upcoming: "bg-brand-soft text-brand",
  live: "bg-mint text-white",
  ended: "bg-line text-muted",
  cancelled: "bg-chili-soft text-chili",
};

/** The little picture for each kind of event. */
export function KindIcon({ kind, size = 16, className }: { kind: string; size?: number; className?: string }) {
  if (kind === "spotlight") return <Star size={size} className={className} />;
  if (kind === "party") return <Music size={size} className={className} />;
  return (
    <span className={clsx("inline-flex", className)} style={{ width: size + 4 }}>
      <MaskIcon className="w-full" eyes="transparent" />
    </span>
  );
}

export function KindChip({ kind, light }: { kind?: string; light?: boolean }) {
  const k = EVENT_KINDS.find((x) => x.value === kind) ?? EVENT_KINDS[0];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
      light ? "bg-white/15 text-white" : "bg-brand-soft text-brand")}>
      <KindIcon kind={k.value} size={12} /> {k.short}
    </span>
  );
}

export function NightCard({ night: n }: { night: AdminNight }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const phase = n.status === "draft" ? "draft" : eventPhase(n);
  const masked = (n.kind ?? "masquerade") === "masquerade";
  return (
    <Link href={`/admin/nights/${n.id}`} className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={clsx("relative overflow-hidden bg-gradient-to-br p-5 text-white", themeBg(n.theme))}>
        {n.cover_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          </>
        )}
        <span aria-hidden className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <KindChip kind={n.kind} light />
          <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase", BADGE[phase])}>{phase}</span>
        </div>
        <p className="relative mt-3 text-[18px] leading-tight font-semibold">{n.title}</p>
        <p className="relative mt-1 text-[13px] text-white/80">{mounted ? eventWhen(n.starts_at, n.ends_at) : ""}</p>
      </div>
      <div className={clsx("grid divide-x divide-line text-center", masked ? "grid-cols-3" : "grid-cols-2")}>
        <Mini icon={<Users size={14} />} value={n.going_count} label="going" />
        {masked && <Mini icon={<MaskIcon className="w-4" eyes="#fff" />} value={n.rounds} label={word(n.rounds, "round")} />}
        <Mini icon={<KeyRound size={14} />} value={n.keys_collected} label={word(n.keys_collected, "Key")} />
      </div>
    </Link>
  );
}

function Mini({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="py-3">
      <p className="flex items-center justify-center gap-1 text-[16px] font-bold">
        <span className="text-muted">{icon}</span>
        {value}
      </p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

export function NightsList({ nights }: { nights: AdminNight[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const upcoming = nights.filter((n) => n.status === "draft" || (now !== null && new Date(n.ends_at).getTime() > now && n.status !== "cancelled"));
  const past = nights.filter((n) => !upcoming.includes(n));
  return (
    <>
      <AdminTitle
        title="Events"
        subtitle="Masquerade Nights, Spotlight Nights and Listening Parties. Everyone comes online at the same time."
        action={
          <Link href="/admin/nights/new" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-[14px] font-semibold text-white">
            <Plus size={17} /> New event
          </Link>
        }
      />
      {nights.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface p-12 text-center">
          <CalendarDays size={34} className="text-brand" />
          <p className="mt-3 text-[17px] font-semibold">No events yet</p>
          <p className="mt-1 max-w-sm text-[14px] text-muted">Create your first event. You can save it as a draft and publish when ready.</p>
        </div>
      )}
      {upcoming.length > 0 && (
        <>
          <h2 className="mb-3 text-[15px] font-semibold">Upcoming & drafts</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...upcoming].reverse().map((n) => (
              <NightCard key={n.id} night={n} />
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-[15px] font-semibold">Past & cancelled</h2>
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-cream text-[12px] text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Going</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Rounds</th>
                  <th className="px-4 py-3 font-semibold">Unmasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {past.map((n) => (
                  <tr key={n.id} className="hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/nights/${n.id}`} className="font-semibold hover:text-brand">{n.title}</Link>
                        <KindChip kind={n.kind} />
                      </div>
                      <p className="text-[12px] text-muted">
                        {n.status === "cancelled" ? "Cancelled · " : ""}
                        {intentLabel(n.intent)} · {n.age_min}–{n.age_max}
                        <span className="ml-1 inline-flex items-center gap-0.5"><MessageCircleQuestion size={11} /> {n.question_count}</span>
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">{n.going_count}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{(n.kind ?? "masquerade") === "masquerade" ? n.rounds : "–"}</td>
                    <td className="px-4 py-3">{(n.kind ?? "masquerade") === "masquerade" ? n.unmasks : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
