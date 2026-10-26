export const dynamic = "force-dynamic";

import Link from "next/link";
import clsx from "clsx";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { AdminTitle } from "@/components/admin/AdminShell";

type Row = { kind: "page" | "browser" | "server"; name: string; count: number; p50: number; p90: number; max: number; failed: number };

const PERIODS = [
  { hours: 1, label: "Last hour" },
  { hours: 24, label: "Last 24 hours" },
  { hours: 168, label: "Last 7 days" },
];

const SECTIONS: { kind: Row["kind"]; title: string; note: string }[] = [
  { kind: "page", title: "Pages", note: "“server”: the server building the page. “first load”: opening Dashpad on that page until it shows. “open”: tapping through to it until it shows." },
  { kind: "server", title: "Database, while building pages", note: "Each request the server makes before a page can show. These add up: a page waits for its slowest one (or the sum, if one waits for another)." },
  { kind: "browser", title: "Database, from phones", note: "Requests phones make once a page is open (lists, live counts, sending messages)." },
];

/** Admin → Speed: how long pages and requests take, slowest first */
export default async function SpeedPage({ searchParams }: { searchParams: Promise<{ hours?: string }> }) {
  await requireAdmin();
  const asked = (await searchParams).hours;
  const hours = PERIODS.find((p) => String(p.hours) === asked)?.hours ?? 24;
  const { data, error } = await createAdminClient().rpc("admin_speed_summary", { p_hours: hours });
  const rows = (Array.isArray(data) ? data : []) as Row[];

  return (
    <>
      <AdminTitle
        title="Speed"
        subtitle="How long pages and database requests take for real people, slowest first. About 1 visit in 3 is recorded; kept 7 days."
      />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p.hours}
            href={`/admin/speed?hours=${p.hours}`}
            className={clsx(
              "inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold",
              p.hours === hours ? "bg-ink text-white" : "border border-line-strong bg-surface text-ink-soft hover:bg-ink/5",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">Run update 90 in Supabase first.</p>
      ) : !rows.length ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">Nothing recorded in this period yet. Timings arrive as people use Dashpad.</p>
      ) : (
        <div className="space-y-8">
          <Legend />
          {SECTIONS.map((s) => {
            const list = rows.filter((r) => r.kind === s.kind).sort((a, b) => b.p90 - a.p90);
            if (!list.length) return null;
            return (
              <section key={s.kind}>
                <h2 className="text-[18px] font-semibold">{s.title}</h2>
                <p className="mt-1 mb-3 max-w-2xl text-[14px] text-muted">{s.note}</p>
                <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-card">
                  <table className="w-full min-w-[640px] text-left text-[14px] tabular-nums">
                    <thead className="text-[12px] tracking-wide text-muted uppercase">
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 font-semibold">What</th>
                        <th className="px-3 py-3 text-right font-semibold">Times</th>
                        <th className="px-3 py-3 text-right font-semibold">Typical</th>
                        <th className="px-3 py-3 text-right font-semibold">Slow (1 in 10)</th>
                        <th className="px-3 py-3 text-right font-semibold">Slowest</th>
                        <th className="px-4 py-3 text-right font-semibold">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.name} className="border-b border-line last:border-0">
                          <td className="max-w-[340px] truncate px-4 py-2.5 font-medium" title={r.name}>{r.name}</td>
                          <td className="px-3 py-2.5 text-right text-muted">{r.count.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right"><Ms ms={r.p50} /></td>
                          <td className="px-3 py-2.5 text-right"><Ms ms={r.p90} /></td>
                          <td className="px-3 py-2.5 text-right text-muted">{fmt(r.max)}</td>
                          <td className={clsx("px-4 py-2.5 text-right", r.failed ? "font-semibold text-chili" : "text-muted")}>{r.failed || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

/** Green under 300 ms, amber under 1 second, red over */
function Ms({ ms }: { ms: number }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 font-semibold",
        ms < 300 ? "bg-mint-soft text-[#11704a]" : ms < 1000 ? "bg-gold-soft text-[#8a5a00]" : "bg-chili-soft text-chili",
      )}
    >
      {fmt(ms)}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
      <span className="inline-flex items-center gap-1.5"><Ms ms={120} /> fast</span>
      <span className="inline-flex items-center gap-1.5"><Ms ms={600} /> noticeable</span>
      <span className="inline-flex items-center gap-1.5"><Ms ms={1500} /> slow</span>
      <span>“Typical”: half are faster than this. “Slow”: 1 in 10 is slower than this.</span>
    </div>
  );
}
