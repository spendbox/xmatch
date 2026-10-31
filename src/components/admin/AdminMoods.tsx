import { INTENTS } from "@/lib/constants";
import { INTENT_ICONS } from "@/components/ui/icons";
import { MOODS } from "@/lib/moods";
import type { Intent } from "@/lib/types";

export type MoodRow = { intent: Intent; total: number; active_7d: number; online: number; masquerade_on: number; women: number; men: number };

/** Admin → Overview: what mood people are choosing, with how many are active, online and switched on */
export function AdminMoods({ rows }: { rows: MoodRow[] | null }) {
  if (!rows) {
    return (
      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Moods</h2>
        <p className="mt-1 text-[13px] text-muted">Run supabase/updates/110_moods_full_answers.sql in Supabase to see what mood people choose.</p>
      </section>
    );
  }
  const all = INTENTS.map((i) => rows.find((r) => r.intent === i.value) ?? { intent: i.value, total: 0, active_7d: 0, online: 0, masquerade_on: 0, women: 0, men: 0 });
  const total = all.reduce((n, r) => n + r.total, 0);
  const active = all.reduce((n, r) => n + r.active_7d, 0);
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Moods</h2>
        <p className="text-[12.5px] text-muted">What people have chosen · {total.toLocaleString()} members · {active.toLocaleString()} active this week</p>
      </div>
      <ul className="mt-4 space-y-3">
        {all.map((r) => {
          const label = INTENTS.find((i) => i.value === r.intent)?.label ?? r.intent;
          const share = pct(r.total, total);
          const activeShare = pct(r.active_7d, active);
          return (
            <li key={r.intent} className="rounded-2xl bg-cream p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: MOODS[r.intent].gradient }}>
                  {INTENT_ICONS[r.intent]({ size: 19, strokeWidth: 2.2 })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold">{label}</span>
                    <span className="text-[15px] font-semibold tabular-nums">
                      {r.total.toLocaleString()} <span className="text-[13px] font-normal text-muted">· {share}%</span>
                    </span>
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: MOODS[r.intent].accent }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-ink-soft sm:grid-cols-4">
                <span>
                  <b className="tabular-nums">{r.active_7d.toLocaleString()}</b> active this week <span className="text-muted">({activeShare}%)</span>
                </span>
                <span>
                  <b className="tabular-nums">{r.online.toLocaleString()}</b> online now
                </span>
                <span>
                  <b className="tabular-nums">{r.masquerade_on.toLocaleString()}</b> with Masquerade on
                </span>
                <span>
                  <b className="tabular-nums">{r.women.toLocaleString()}</b> women · <b className="tabular-nums">{r.men.toLocaleString()}</b> men
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
