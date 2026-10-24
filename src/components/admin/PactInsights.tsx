import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { INTENTS, people as peopleCount, plural, type About, type Answers, type Pact, type PactQuestion } from "@/lib/pacts";
import { pactDate } from "@/lib/pacts";
import { AdminAutoRefresh } from "./AdminAutoRefresh";

export type Insights = {
  entries: number;
  with_account: number;
  today: number;
  answers: { q: string; a: string; n: number }[];
  answered: Record<string, number>;
  intents: Record<string, number>;
  gender: Record<string, number>;
  areas: Record<string, number>;
  work: Record<string, number>;
  ages: Record<string, number>;
  matches: { total: number; rematches: number; avg_score: number | null; by_intent: Record<string, number>; seen: number; chats: number; both_joined: number };
};
export type PersonRow = { id: string; email: string | null; user_id: string | null; about: About; answers: Answers; created_at: string; match_seen_at: string | null };

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const intentName = (k: string) => INTENTS.find((i) => i.id === k)?.label ?? k;

/** Admin: how people answered, who took part, and how matching went */
export function PactInsights({ pact, questions, insights: s, people, page, perPage }: { pact: Pact & { reveal_step: string | null; reveal_stats: Record<string, unknown> }; questions: PactQuestion[]; insights: Insights; people: PersonRow[]; page: number; perPage: number }) {
  const step = pact.reveal_step;
  const working = pact.status !== "draft" && new Date(pact.closes_at).getTime() <= Date.now() && step !== "done";
  const peopleMatched = s.matches.total * 2;
  const counts = new Map(s.answers.map((r) => [`${r.q}|${r.a}`, r.n]));
  const pages = Math.max(1, Math.ceil(s.entries / perPage));
  const stage =
    step === "match" ? "Matching everyone now" : step === "ready" ? "Matches ready, hidden until reveal night" : step === "chats" ? "Revealed · starting chats" : step === "notify" ? "Revealed · telling everyone" : step === "done" ? "Revealed" : null;

  return (
    <div className="pb-16">
      {working && <AdminAutoRefresh seconds={10} />}
      <Link href={`/admin/pacts/${pact.id}`} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted"><ArrowLeft size={16} /> {pact.name}</Link>
      <h1 className="font-display text-[30px] leading-tight font-semibold sm:text-[34px]">Answers and results</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        Answers close {pactDate(pact.closes_at)} · reveal night {pactDate(pact.reveal_at)}
        {working && <span className="font-semibold text-brand"> · updates every 10 seconds</span>}
      </p>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Took the pact" value={s.entries} sub={`${s.today.toLocaleString()} in the last 24 hours`} />
        <Tile label="Have an account" value={s.with_account} sub={`${pct(s.with_account, s.entries)}% of everyone`} />
        <Tile label="Matches made" value={s.matches.total} sub={s.matches.total ? `${peopleCount(peopleMatched)} · ${pct(peopleMatched, s.entries)}% matched` : stage ?? "After answers close"} accent />
        <Tile label="Average match" value={s.matches.avg_score ?? 0} suffix="%" sub={s.matches.total ? "how alike pairs are" : "—"} />
      </section>

      {(s.matches.total > 0 || stage) && (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Matching</h2>
            {stage && <span className="rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-semibold text-brand">{stage}</span>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Both on Dashpad" value={s.matches.both_joined} of={s.matches.total} />
            <Mini label="Chats started" value={s.matches.chats} of={s.matches.total} />
            <Mini label="Revealed their match" value={s.matches.seen} of={peopleMatched} />
            <Mini label="Rematches" value={s.matches.rematches} />
          </div>
          {s.matches.total > 0 && <Bars title="Matched for" total={s.matches.total} rows={Object.entries(s.matches.by_intent).map(([k, n]) => ({ label: intentName(k), n }))} unit="match" />}
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[17px] font-semibold">How people answered</h2>
        {s.entries === 0 && <p className="mt-2 text-[14px] text-muted">No answers yet.</p>}
        <div className="mt-2 grid gap-x-8 lg:grid-cols-2">
          {s.entries > 0 &&
            questions.map((q, i) => {
              const answered = s.answered[q.id] ?? 0;
              const rows =
                q.kind === "scale"
                  ? [1, 2, 3, 4, 5].map((n) => ({ label: n === 1 ? `1 · ${q.options[0]?.label ?? ""}` : n === 5 ? `5 · ${q.options[1]?.label ?? ""}` : String(n), n: counts.get(`${q.id}|${n}`) ?? 0 }))
                  : q.options.map((o) => ({ label: o.label, n: counts.get(`${q.id}|${o.id}`) ?? 0, image: o.image }));
              return <Bars key={q.id} title={`${i + 1}. ${q.title}`} note={q.kind === "choose_many" ? "People could pick several, so these add up to more than 100%" : undefined} total={answered} rows={q.kind === "choose_many" ? rows.sort((a, b) => b.n - a.n) : rows} unit="person" />;
            })}
        </div>
      </section>

      {s.entries > 0 && (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[17px] font-semibold">Who took part</h2>
          <div className="mt-2 grid gap-x-8 lg:grid-cols-2">
            <Bars title="Here for" total={s.entries} rows={INTENTS.filter((i) => pact.intents.includes(i.id)).map((i) => ({ label: i.label, n: s.intents[i.id] ?? 0 }))} unit="person" />
            <Bars title="Gender" total={s.entries} rows={[{ label: "Women", n: s.gender.woman ?? 0 }, { label: "Men", n: s.gender.man ?? 0 }]} unit="person" />
            <Bars title="Age" total={s.entries} rows={["18-21", "22-25", "26-30", "31-35", "36-45", "46+"].map((k) => ({ label: k, n: s.ages[k] ?? 0 }))} unit="person" />
            {pact.areas.length > 0 && <Bars title="Area" total={s.entries} rows={pact.areas.map((a) => ({ label: a, n: s.areas[a] ?? 0 }))} unit="person" />}
            {Object.keys(s.work).length > 0 && <Bars title="Work (people here for business)" total={Object.values(s.work).reduce((x, y) => x + y, 0)} rows={Object.entries(s.work).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }))} unit="person" />}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Everyone&apos;s answers</h2>
          <span className="text-[13px] text-muted">Newest first · {peopleCount(s.entries)}</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {people.map((p) => (
            <li key={p.id} className="min-w-0 rounded-2xl border border-line">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{p.email ?? "No email"}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {[p.about.gender === "woman" ? "Woman" : p.about.gender === "man" ? "Man" : null, p.about.age, p.about.area, (p.about.intents ?? []).map(intentName).join(", ")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {p.user_id && <span className="hidden shrink-0 rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold text-[#16865a] sm:block">Account</span>}
                  <span className="shrink-0 text-[12px] text-muted">{pactDate(p.created_at)}</span>
                  <ChevronRight size={16} className="shrink-0 text-muted transition group-open:rotate-90" />
                </summary>
                <dl className="grid gap-1.5 border-t border-line px-4 py-3 text-[13.5px]">
                  {questions.map((q) => (
                    <div key={q.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                      <dt className="text-muted">{q.title}</dt>
                      <dd className="font-medium">{answerText(q, p.answers[q.id])}</dd>
                    </div>
                  ))}
                  {p.about.work && (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                      <dt className="text-muted">Work</dt>
                      <dd className="font-medium">{p.about.work}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                    <dt className="text-muted">Wants to meet</dt>
                    <dd className="font-medium">
                      {p.about.ageMin}–{p.about.ageMax >= 99 ? "any" : p.about.ageMax}
                      {p.about.seeking?.length ? ` · ${p.about.seeking.map((g) => (g === "woman" ? "women" : "men")).join(" and ")}` : ""}
                    </dd>
                  </div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <PageLink id={pact.id} page={page - 1} off={page <= 1}><ChevronLeft size={16} /> Newer</PageLink>
            <span className="text-[13px] text-muted">Page {page} of {pages.toLocaleString()}</span>
            <PageLink id={pact.id} page={page + 1} off={page >= pages}>Older <ChevronRight size={16} /></PageLink>
          </div>
        )}
      </section>
    </div>
  );
}

function answerText(q: PactQuestion, v: Answers[string] | undefined) {
  if (v === undefined) return "—";
  if (q.kind === "scale") return `${v} of 5 (${q.options[0]?.label ?? ""} → ${q.options[1]?.label ?? ""})`;
  const label = (id: string) => q.options.find((o) => o.id === id)?.label ?? "?";
  return Array.isArray(v) ? v.map(label).join(", ") : label(String(v));
}

function Tile({ label, value, sub, suffix, accent }: { label: string; value: number; sub: string; suffix?: string; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className={"mt-1 font-display text-[30px] leading-none font-semibold tabular-nums " + (accent ? "text-brand" : "")}>
        {value.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-1.5 truncate text-[12px] text-muted">{sub}</p>
    </div>
  );
}

function Mini({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div className="rounded-2xl bg-cream px-3 py-2.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[18px] font-semibold tabular-nums">
        {value.toLocaleString()}
        {of ? <span className="ml-1 text-[12.5px] font-normal text-muted">{pct(value, of)}%</span> : null}
      </p>
    </div>
  );
}

/** One question or measure: a bar per answer, with the count and share written beside it */
function Bars({ title, note, total, rows, unit }: { title: string; note?: string; total: number; rows: { label: string; n: number; image?: string | null }[]; unit: "person" | "match" }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <figure className="mt-5 min-w-0">
      <figcaption className="text-[14.5px] font-semibold">{title}</figcaption>
      <p className="text-[12px] text-muted">{note ?? (unit === "person" ? `${plural(total, "person", "people")} answered` : plural(total, "match", "matches"))}</p>
      <ul className="mt-2.5 grid gap-1.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]" title={`${r.label}: ${r.n.toLocaleString()} (${pct(r.n, total)}%)`}>
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              {r.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
              )}
              <span className="truncate">{r.label}</span>
            </span>
            <span className="h-3.5 rounded-r-[4px] bg-line/70">
              <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${(r.n / top) * 100}%`, minWidth: r.n ? 3 : 0 }} />
            </span>
            <span className="w-[4.5rem] text-right text-[12.5px] tabular-nums">
              <b className="font-semibold">{pct(r.n, total)}%</b> <span className="text-muted">{r.n.toLocaleString()}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function PageLink({ id, page, off, children }: { id: string; page: number; off: boolean; children: React.ReactNode }) {
  if (off) return <span className="inline-flex h-10 items-center gap-1 px-3 text-[13.5px] font-semibold text-muted/50">{children}</span>;
  return <Link href={`/admin/pacts/${id}/answers?page=${page}`} className="inline-flex h-10 items-center gap-1 rounded-full border border-line-strong bg-white px-4 text-[13.5px] font-semibold">{children}</Link>;
}
