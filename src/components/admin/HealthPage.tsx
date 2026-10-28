"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { naira } from "@/lib/keys";
import { AdminTitle } from "./AdminShell";
import { saveSetting } from "@/app/admin/(panel)/prices/actions";

export type Health = {
  people: { total: number; joined: number; joined_prev: number; active_day: number; active_week: number };
  retention_week: { cohort: number; back: number };
  retention_month: { cohort: number; back: number };
  modes: { mode: "friends" | "dating" | "spicy"; active: number; women: number; men: number; other: number }[];
  masquerade: { pairs: number; pairs_prev: number; both_unmasked: number; both_unmasked_prev: number; reported: number };
  play: { games: number; games_prev: number; waits: number; wait_median: number | null; wait_p90: number | null; waiting_now: number };
  safety: {
    reports: number;
    reports_prev: number;
    reported_people: number;
    hidden: number;
    hidden_prev: number;
    auto_limit: number;
    to_review: { id: string; name: string | null; photo: string | null; at: string; reports: number; reasons: string[] }[];
    most_reported: { id: string; name: string | null; photo: string | null; n: number }[];
  };
  money: { buyers: number; buyers_prev: number; revenue_kobo: number; revenue_prev_kobo: number };
  invites: { joined: number; joined_prev: number; inviters: number };
};

type Tone = "good" | "watch" | "bad" | "none";
const TONE: Record<Tone, { dot: string; label: string }> = {
  good: { dot: "bg-mint", label: "Healthy" },
  watch: { dot: "bg-gold", label: "Watch" },
  bad: { dot: "bg-chili", label: "Needs work" },
  none: { dot: "bg-line-strong", label: "Too early to tell" },
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const MODES: Record<string, string> = { friends: "Friends", dating: "Dating", spicy: "Spicy" };
const secs = (s: number | null) => (s == null ? "–" : s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);

/** Admin → Health: the handful of numbers that say whether Dashpad is growing well, with what "good" looks like */
export function HealthPage({ health: h, missing }: { health: Health | null; missing: boolean }) {
  if (!h)
    return (
      <>
        <AdminTitle title="Health" />
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
          <p className="text-[16px] font-semibold">{missing ? "One step first" : "No numbers yet"}</p>
          <p className="mt-1 text-[14px] text-muted">
            {missing ? "Run supabase/updates/101_health_safety.sql in Supabase (SQL Editor → New query → paste → Run), then refresh this page." : "Check back once people are using Dashpad."}
          </p>
        </div>
      </>
    );

  const active = h.people.active_week;
  // Came back a week after joining (needs at least 10 people to mean anything)
  const rw = h.retention_week;
  const rwPct = pct(rw.back, rw.cohort);
  const rwTone: Tone = rw.cohort < 10 ? "none" : rwPct >= 25 ? "good" : rwPct >= 15 ? "watch" : "bad";
  const rm = h.retention_month;
  const rmPct = pct(rm.back, rm.cohort);
  const rmTone: Tone = rm.cohort < 10 ? "none" : rmPct >= 12 ? "good" : rmPct >= 6 ? "watch" : "bad";
  const unmaskPct = pct(h.masquerade.both_unmasked, h.masquerade.pairs);
  const unmaskPrev = pct(h.masquerade.both_unmasked_prev, h.masquerade.pairs_prev);
  const unmaskTone: Tone = h.masquerade.pairs < 10 ? "none" : unmaskPct >= 20 ? "good" : unmaskPct >= 10 ? "watch" : "bad";
  const waitTone: Tone = h.play.waits < 5 || h.play.wait_median == null ? "none" : h.play.wait_median <= 60 ? "good" : h.play.wait_median <= 180 ? "watch" : "bad";
  const buyPct = active ? (h.money.buyers / active) * 100 : 0;
  const buyTone: Tone = active < 30 ? "none" : buyPct >= 3 ? "good" : buyPct >= 1 ? "watch" : "bad";
  const reportRate = active ? (h.safety.reports / active) * 100 : 0;
  const reportTone: Tone = active < 30 ? "none" : reportRate < 2 ? "good" : reportRate <= 5 ? "watch" : "bad";

  return (
    <>
      <AdminTitle title="Health" subtitle="This week against last week, and what good looks like. Green is healthy, amber is worth watching, red needs work." />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active this week" value={active} sub={`${h.people.active_day} today · ${h.people.total.toLocaleString()} members`} />
        <Stat label="Joined this week" value={h.people.joined} prev={h.people.joined_prev} sub="finished setting up" />
        <Stat label="Joined from invites" value={h.invites.joined} prev={h.invites.joined_prev} sub={`${h.invites.inviters} ${h.invites.inviters === 1 ? "person" : "people"} invited someone`} />
        <Stat label="Earned this week" value={naira(Math.round(h.money.revenue_kobo / 100))} raw={h.money.revenue_kobo} prev={h.money.revenue_prev_kobo} sub={`${h.money.buyers} ${h.money.buyers === 1 ? "buyer" : "buyers"}`} />
      </section>

      <h2 className="mt-8 mb-3 text-[18px] font-semibold">The signs that matter</h2>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Sign tone={rwTone} title="Come back a week later" value={rw.cohort < 10 ? "–" : `${rwPct}%`} detail={`${rw.back} of ${rw.cohort} people who joined 8–14 days ago used Dashpad again a week or more after joining.`} good="Healthy: 25% or more" />
        <Sign tone={rmTone} title="Come back a month later" value={rm.cohort < 10 ? "–" : `${rmPct}%`} detail={`${rm.back} of ${rm.cohort} people who joined 1–2 months ago were still using it after 30 days.`} good="Healthy: 12% or more" />
        <Sign tone={unmaskTone} title="Masked chats where both unmask" value={h.masquerade.pairs < 10 ? "–" : `${unmaskPct}%`} detail={`${h.masquerade.both_unmasked} of ${h.masquerade.pairs} masked chats this week (last week ${unmaskPrev}%).`} good="Healthy: 20% or more" />
        <Sign tone={waitTone} title="Wait for a Play game" value={secs(h.play.wait_median)} detail={`Typical wait this week (1 in 10 waited over ${secs(h.play.wait_p90)}). ${h.play.games} games played (last week ${h.play.games_prev}). ${h.play.waiting_now} waiting right now.`} good="Healthy: under a minute" />
        <Sign tone={buyTone} title="People who buy Keys" value={active < 30 ? "–" : `${buyPct.toFixed(1)}%`} detail={`${h.money.buyers} of ${active} active people bought Keys this week (last week ${h.money.buyers_prev}).`} good="Healthy: 3% or more" />
        <Sign tone={reportTone} title="Reports" value={`${h.safety.reports}`} detail={`${h.safety.reports} reports about ${h.safety.reported_people} ${h.safety.reported_people === 1 ? "person" : "people"} this week (last week ${h.safety.reports_prev}). ${active ? `${reportRate.toFixed(1)} per 100 active people.` : ""}`} good="Healthy: under 2 per 100 active people" />
      </section>

      <h2 className="mt-8 mb-3 text-[18px] font-semibold">Who's active, by mode</h2>
      <section className="grid gap-3 sm:grid-cols-3">
        {(["friends", "dating", "spicy"] as const).map((m) => {
          const r = h.modes.find((x) => x.mode === m) ?? { active: 0, women: 0, men: 0, other: 0 };
          const wPct = pct(r.women, r.active);
          // Balance matters most where people are looking for each other
          const tone: Tone = r.active < 20 ? "none" : m === "friends" ? "good" : wPct >= 35 ? "good" : wPct >= 25 ? "watch" : "bad";
          return (
            <div key={m} className="rounded-3xl border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold">{MODES[m]}</p>
                <ToneTag tone={tone} />
              </div>
              <p className="mt-1 font-display text-[30px] font-semibold">{r.active}</p>
              <p className="text-[13px] text-muted">active this week</p>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line">
                <span className="bg-[#c2306b]" style={{ width: `${wPct}%` }} />
                <span className="bg-brand" style={{ width: `${pct(r.men, r.active)}%` }} />
                <span className="bg-gold" style={{ width: `${pct(r.other, r.active)}%` }} />
              </div>
              <p className="mt-2 text-[12.5px] text-muted">
                {wPct}% women · {pct(r.men, r.active)}% men{r.other ? ` · ${pct(r.other, r.active)}% other` : ""}
                {m !== "friends" && " · healthy: 35%+ women"}
              </p>
            </div>
          );
        })}
      </section>

      <h2 className="mt-8 mb-3 text-[18px] font-semibold">Safety</h2>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <ShieldAlert size={18} className="text-chili" /> Suspended automatically, waiting for you
          </p>
          <p className="mt-1 text-[13px] text-muted">Reported by {h.safety.auto_limit} or more different people in 30 days. Open each one: keep the ban, or unban if it was unfair.</p>
          <div className="mt-3 grid min-w-0 gap-2">
            {h.safety.to_review.length ? (
              h.safety.to_review.map((p) => <Person key={p.id} id={p.id} name={p.name} photo={p.photo} note={`${p.reports} reports${p.reasons.length ? ` · "${p.reasons.join('", "')}"` : ""}`} />)
            ) : (
              <p className="rounded-2xl bg-cream px-4 py-3 text-[14px] text-muted">Nobody waiting. 🎉</p>
            )}
          </div>
          <AutoLimit value={h.safety.auto_limit} />
        </div>
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <ShieldCheck size={18} className="text-mint" /> Contact details hidden
          </p>
          <p className="mt-1 font-display text-[30px] font-semibold">{h.safety.hidden}</p>
          <p className="text-[13px] text-muted">
            messages this week (last week {h.safety.hidden_prev}) had a phone or bank number, link or email hidden. This happens in masked chats and in any chat&apos;s first 24 hours, where most scams start.
          </p>
          <p className="mt-5 text-[15px] font-semibold">Most reported this week</p>
          <div className="mt-2 grid min-w-0 gap-2">
            {h.safety.most_reported.length ? (
              h.safety.most_reported.map((p) => <Person key={p.id} id={p.id} name={p.name} photo={p.photo} note={`${p.n} ${p.n === 1 ? "report" : "reports"}`} />)
            ) : (
              <p className="rounded-2xl bg-cream px-4 py-3 text-[14px] text-muted">No reports this week.</p>
            )}
          </div>
          <p className="mt-3 text-[12.5px] text-muted">Someone who reports a person is never paired with them again.</p>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, sub, prev, raw }: { label: string; value: number | string; sub: string; prev?: number; raw?: number }) {
  const now = raw ?? (typeof value === "number" ? value : 0);
  const up = prev !== undefined && now > prev;
  const down = prev !== undefined && now < prev;
  return (
    <div className="min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-card">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-display text-[30px] font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
        {up && <ArrowUpRight size={20} className="text-mint" />}
        {down && <ArrowDownRight size={20} className="text-chili" />}
      </p>
      <p className="text-[13px] text-muted">{sub}</p>
    </div>
  );
}

function ToneTag({ tone }: { tone: Tone }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold">
      <span className={clsx("h-2 w-2 rounded-full", TONE[tone].dot)} /> {TONE[tone].label}
    </span>
  );
}

function Sign({ tone, title, value, detail, good }: { tone: Tone; title: string; value: string; detail: string; good: string }) {
  return (
    <div className="flex gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
      <span className={clsx("mt-1 h-3 w-3 shrink-0 rounded-full", TONE[tone].dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px] font-semibold">{title}</p>
          <p className="font-display text-[26px] font-semibold">{value}</p>
        </div>
        <p className="mt-1 text-[13.5px] text-ink-soft">{detail}</p>
        <p className="mt-1 text-[12.5px] text-muted">
          {good} · <span className="font-semibold">{TONE[tone].label}</span>
        </p>
      </div>
    </div>
  );
}

function Person({ id, name, photo, note }: { id: string; name: string | null; photo: string | null; note: string }) {
  return (
    <Link href={`/admin/members/${id}`} className="flex min-w-0 items-center gap-3 rounded-2xl bg-cream px-3 py-2.5 hover:bg-line/60">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="h-10 w-10 shrink-0 rounded-full bg-line" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{name ?? "No name"}</span>
        <span className="block truncate text-[12.5px] text-muted">{note}</span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-brand">Open</span>
    </Link>
  );
}

/** How many different people's reports suspend someone automatically (0 turns it off) */
function AutoLimit({ value }: { value: number }) {
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-cream p-3 text-[13.5px]">
      <span className="min-w-0 flex-1">Suspend automatically after reports from</span>
      <input type="number" min={0} max={20} value={v} onChange={(e) => { setV(Number(e.target.value)); setMsg(null); }} className="h-10 w-16 rounded-xl border border-line bg-surface px-2 text-center" />
      <span>people</span>
      <button
        type="button"
        disabled={v === value}
        onClick={async () => {
          const r = await saveSetting("auto_suspend_reports", v);
          setMsg(r.error ? r.error : v === 0 ? "Saved · off" : "Saved");
        }}
        className="h-10 rounded-xl bg-brand px-4 font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
      {msg && <span className="w-full text-[12.5px] text-muted">{msg}</span>}
    </div>
  );
}
