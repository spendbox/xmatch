import clsx from "clsx";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminTitle } from "./AdminShell";

type Hour = {
  hour_at: string;
  open: boolean;
  ran_at: string | null;
  eligible: number | null;
  note: string | null;
  pairs: number;
  clicked: number;
  undecided: number;
  reopened: number;
  quiet: number;
  let_go: number;
  live: number;
  not_notified: number;
};

export type MasqueradeStats = {
  now: string;
  hours: Hour[];
  switched_on: number;
  eligible_now: number;
  no_place: number;
  week: { pairs: number; clicked: number; quiet: number; reopened: number };
  by_mood: Record<string, number>;
};

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", hour12: true, timeZone: "Africa/Lagos" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** Is hourly pairing healthy? What happens to pairs? */
export function MasqueradeHealth({ stats }: { stats: MasqueradeStats | null }) {
  if (!stats) return <AdminTitle title="Masquerade" subtitle="Couldn't load the numbers. Has part 20 of the database setup been run?" />;
  const past = stats.hours.filter((h) => h.open && new Date(h.hour_at).getTime() < Date.now() - 5 * 60_000).slice(0, 24);
  const missed = past.filter((h) => !h.ran_at);
  const late = past.filter((h) => h.note === "late");
  const unnotified = past.reduce((n, h) => n + (h.pairs ? h.not_notified : 0), 0);
  const w = stats.week;

  const issues: string[] = [];
  // Live pairing (update 66): an hour with nobody online simply has no pairs, so missed or late hours aren't problems any more
  void missed;
  void late;
  if (unnotified > 0) issues.push(`${unnotified} pairs weren't sent a "new pair" notification. Check that CRON_SECRET in part 18 matches Vercel.`);
  if (stats.no_place > 0) issues.push(`${stats.no_place} people with Masquerade on haven't set where they are, so they're paired without closeness.`);

  return (
    <>
      <AdminTitle title="Masquerade" subtitle="Live pairing while people are online, 6am to 2am (Lagos time). Last 48 hours." />

      <div className={clsx("mb-6 rounded-2xl border p-4", issues.length ? "border-gold/50 bg-gold-soft" : "border-mint/30 bg-mint-soft")}>
        {issues.length ? (
          <ul className="space-y-2">
            {issues.map((t) => (
              <li key={t} className="flex gap-2.5 text-[14px] font-medium text-[#8a5a00]">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2.5 text-[14px] font-semibold text-mint">
            <CheckCircle2 size={18} /> Pairing is running and new pairs were notified.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Box label="Switched on" value={stats.switched_on} sub={`${stats.eligible_now} active in the last day`} />
        <Box label="Pairs this week" value={w.pairs} sub={Object.entries(stats.by_mood).map(([k, v]) => `${k} ${v}`).join(" · ") || "none yet"} />
        <Box label="Clicked" value={w.clicked} sub={`${pct(w.clicked, w.pairs)} of pairs`} />
        <Box label="Never talked" value={w.quiet} sub={`${pct(w.quiet, w.pairs)} · ${w.reopened} reopened`} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-cream text-left text-[12px] text-muted">
            <tr>
              {["Hour", "Ran", "Eligible", "Pairs", "Clicked", "Undecided", "Let go", "Quiet", "Reopened", "Live", "Not told"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stats.hours.map((h) => (
              <tr key={h.hour_at} className={clsx(!h.open && "text-muted")}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{hourLabel(h.hour_at)}</td>
                <td className="px-3 py-2">
                  {!h.open ? "closed" : h.ran_at ? (h.note === "late" ? <span className="text-[#a26b00]">late</span> : "✓") : <span className="text-chili">missed</span>}
                </td>
                <td className="px-3 py-2">{h.eligible ?? "–"}</td>
                <td className="px-3 py-2 font-semibold">{h.pairs}</td>
                <td className="px-3 py-2 text-mint">{h.clicked}</td>
                <td className="px-3 py-2">{h.undecided}</td>
                <td className="px-3 py-2">{h.let_go}</td>
                <td className="px-3 py-2">{h.quiet}</td>
                <td className="px-3 py-2">{h.reopened}</td>
                <td className="px-3 py-2">{h.live}</td>
                <td className={clsx("px-3 py-2", h.not_notified && h.pairs ? "text-chili" : "")}>{h.pairs ? h.not_notified : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        Eligible: people switched on and active in the last day when pairing ran. Unpaired = eligible minus 2 × pairs (odd one out, or nobody fit).
      </p>
    </>
  );
}

function Box({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <p className="font-display text-[28px] leading-none font-semibold">{value.toLocaleString()}</p>
      <p className="mt-1.5 text-[13px] font-semibold">{label}</p>
      <p className="truncate text-[12px] text-muted">{sub}</p>
    </div>
  );
}
