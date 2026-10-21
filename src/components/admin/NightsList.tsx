"use client";

import { plural, word } from "@/lib/plural";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarHeart, KeyRound, MessageCircleQuestion, Plus, Users } from "lucide-react";
import { eventPhase, eventWhen, themeBg } from "@/lib/events";
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

export function NightCard({ night: n }: { night: AdminNight }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const phase = n.status === "draft" ? "draft" : eventPhase(n);
  return (
    <Link href={`/admin/nights/${n.id}`} className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={clsx("relative bg-gradient-to-br p-5 text-white", themeBg(n.theme))}>
        <span aria-hidden className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <MaskIcon className="w-9 text-white/90" eyes="transparent" />
          <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase", BADGE[phase])}>{phase}</span>
        </div>
        <p className="relative mt-3 text-[18px] leading-tight font-semibold">{n.title}</p>
        <p className="relative mt-1 text-[13px] text-white/80">{mounted ? eventWhen(n.starts_at, n.ends_at) : ""}</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line text-center">
        <Mini icon={<Users size={14} />} value={n.going_count} label="going" />
        <Mini icon={<MaskIcon className="w-4" eyes="#fff" />} value={n.rounds} label={word(n.rounds, "round")} />
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
        title="Masquerade Nights"
        subtitle="Themed hours where everyone masks up at once. Rounds of 5-minute masked chats, a new person each round."
        action={
          <Link href="/admin/nights/new" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-[14px] font-semibold text-white">
            <Plus size={17} /> New night
          </Link>
        }
      />
      {nights.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface p-12 text-center">
          <CalendarHeart size={34} className="text-brand" />
          <p className="mt-3 text-[17px] font-semibold">No nights yet</p>
          <p className="mt-1 max-w-sm text-[14px] text-muted">Create your first Masquerade Night. You can save it as a draft and publish when ready.</p>
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
                  <th className="px-4 py-3 font-semibold">Night</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Going</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Rounds</th>
                  <th className="px-4 py-3 font-semibold">Unmasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {past.map((n) => (
                  <tr key={n.id} className="hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/nights/${n.id}`} className="font-semibold hover:text-brand">{n.title}</Link>
                      <p className="text-[12px] text-muted">
                        {n.status === "cancelled" ? "Cancelled · " : ""}
                        {intentLabel(n.intent)} · {n.age_min}–{n.age_max}
                        <span className="ml-1 inline-flex items-center gap-0.5"><MessageCircleQuestion size={11} /> {n.question_count}</span>
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">{n.going_count}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{n.rounds}</td>
                    <td className="px-4 py-3">{n.unmasks}</td>
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
