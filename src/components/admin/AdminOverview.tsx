import Link from "next/link";
import { plural, word } from "@/lib/plural";
import { CalendarHeart, Flag, Gift, Heart, MessageCircleQuestion, Plus, Users, Wallet, Wifi } from "lucide-react";
import { MaskLineIcon } from "@/components/ui/icons";
import { naira } from "@/lib/keys";
import { AdminTitle } from "./AdminShell";
import { NightCard, type AdminNight } from "./NightsList";

export type Overview = {
  users: number;
  new_users_7d: number;
  online_now: number;
  masquerades_today: number;
  unmasks_today: number;
  matches_total: number;
  revenue_30d_kobo: number;
  keys_sold_30d: number;
  gifts_7d: number;
  reports_7d: number;
  icebreakers: number;
};

export function AdminOverview({ overview: o, nights }: { overview: Overview; nights: AdminNight[] }) {
  const upcoming = nights.filter((n) => n.status !== "cancelled" && new Date(n.ends_at).getTime() > Date.now()).reverse().slice(0, 3);
  const stats = [
    { label: "Members", value: o.users.toLocaleString(), sub: `+${o.new_users_7d} this week`, icon: Users, tone: "bg-brand-soft text-brand" },
    { label: "Online now", value: o.online_now.toLocaleString(), sub: "active in the last 5 min", icon: Wifi, tone: "bg-mint-soft text-mint" },
    { label: "Masquerades today", value: o.masquerades_today.toLocaleString(), sub: `${plural(o.unmasks_today, "mutual unmask")}`, icon: MaskLineIcon, tone: "bg-[#fde8f1] text-[#c2306b]" },
    { label: "Matches", value: o.matches_total.toLocaleString(), sub: "all time", icon: Heart, tone: "bg-chili-soft text-chili" },
    { label: "Revenue (30 days)", value: naira(Math.round(o.revenue_30d_kobo / 100)), sub: `${plural(o.keys_sold_30d, "Key")} sold`, icon: Wallet, tone: "bg-gold-soft text-[#a26b00]" },
    { label: "Gifts sent", value: o.gifts_7d.toLocaleString(), sub: "this week", icon: Gift, tone: "bg-chili-soft text-chili" },
    { label: "Reports", value: o.reports_7d.toLocaleString(), sub: "this week", icon: Flag, tone: o.reports_7d ? "bg-chili text-white" : "bg-cream text-ink-soft" },
    { label: "Icebreakers", value: o.icebreakers.toLocaleString(), sub: "active questions", icon: MessageCircleQuestion, tone: "bg-brand-soft text-brand" },
  ];
  return (
    <>
      <AdminTitle title="Overview" subtitle="How Dashpad is doing right now." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <span className={"grid h-10 w-10 place-items-center rounded-xl " + s.tone}>
              <s.icon size={19} />
            </span>
            <p className="mt-4 font-display text-[28px] leading-none font-semibold">{s.value}</p>
            <p className="mt-1.5 text-[13px] font-semibold">{s.label}</p>
            <p className="text-[12px] text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Upcoming events</h2>
        <Link href="/admin/nights/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white">
          <Plus size={16} /> New night
        </Link>
      </div>
      {upcoming.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {upcoming.map((n) => (
            <NightCard key={n.id} night={n} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <CalendarHeart size={30} className="text-brand" />
          <p className="mt-3 font-semibold">No nights scheduled</p>
          <p className="text-[14px] text-muted">Create one to bring everyone online at the same time.</p>
        </div>
      )}
    </>
  );
}
