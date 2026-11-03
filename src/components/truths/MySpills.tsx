"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ChevronRight, Flame, Lock, Pause, Play, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { formatDuration } from "@/lib/chatMedia";
import { voiceUrl } from "@/lib/voiceDisguise";
import { playIntro, usePlayingIntro } from "@/lib/voiceIntro";
import { DEMO_SPILLS, DEMO_SPILL_STATS, type MySpill, type SpillFilter, type SpillStats } from "@/lib/truths";

const PAGE = 30;
const STYLE_NAME: Record<string, string> = { normal: "Real voice", deep: "Deep", light: "Light", robot: "Robot" };
const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const fmtMonth = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function useSpillStats(demo?: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<SpillStats | null>(demo ? DEMO_SPILL_STATS : null);
  useEffect(() => {
    if (demo) return;
    supabase.rpc("my_spill_stats").then(({ data }) => data && setStats(data as SpillStats));
  }, [supabase, demo]);
  return stats;
}

/**
 * Profile: one small card for My Spills (however many you have). Tap it for the full list.
 * Private: only you see it.
 */
export function MySpills({ demo }: { demo?: boolean }) {
  const stats = useSpillStats(demo);
  // Nothing until you've spilled once (or before update 118 runs)
  if (!stats?.total) return null;
  return (
    <section className="mt-7">
      <Link
        href="/profile/spills"
        onClick={tapFeedback}
        className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card transition active:scale-[0.99]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1a1233]">
          <MaskIcon className="w-7 text-gold" eyes="#1a1233" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[15.5px] font-semibold">
            My Spills
            <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-muted ring-1 ring-line">
              <Lock size={11} /> Private
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            {stats.total.toLocaleString()} spilled
            {!!stats.streak && (
              <>
                <span aria-hidden>·</span>
                <Flame size={13} className="fill-[#ff9a3d] text-[#ff9a3d]" aria-hidden />
                <span className="font-semibold text-[#b5530c]">{stats.streak} days</span>
              </>
            )}
          </span>
          {stats.latest && (
            <span className="mt-1 block truncate text-[13px] text-ink-soft">
              Latest: {stats.latest.body} <b className="text-brand">{stats.latest.answer}</b>
            </span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </section>
  );
}

/** The My Spills page: stats, search, filters, and every Spill grouped by month */
export function MySpillsPage({ demo }: { demo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const stats = useSpillStats(demo);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SpillFilter>("");
  const [list, setList] = useState<MySpill[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const playing = usePlayingIntro();
  const tail = useRef<HTMLDivElement>(null);
  const ask = useRef(0);

  // Wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (before: string | null) => {
      const n = ++ask.current;
      setLoading(true);
      let rows: MySpill[];
      if (demo) {
        const q = search.toLowerCase();
        rows = DEMO_SPILLS.filter(
          (s) =>
            (!before || s.day < before) &&
            (!q || s.body.toLowerCase().includes(q)) &&
            (filter !== "voice" || !!s.key) &&
            (filter !== "minority" || s.same < (s.top ?? 0)),
        ).slice(0, PAGE);
      } else {
        const { data } = await supabase.rpc("my_spills", { p_before: before, p_limit: PAGE, p_query: search || null, p_filter: filter || null });
        rows = Array.isArray(data) ? (data as MySpill[]) : [];
      }
      if (n !== ask.current) return;
      setList((l) => (before ? [...(l ?? []), ...rows] : rows));
      setMore(rows.length === PAGE);
      setLoading(false);
    },
    [supabase, demo, search, filter],
  );

  useEffect(() => {
    setList(null);
    void load(null);
  }, [load]);

  // Load older ones as you reach the bottom
  useEffect(() => {
    const el = tail.current;
    if (!el || !more || loading || !list?.length) return;
    const last = list[list.length - 1].day;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && void load(last), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, loading, list, load]);

  // Group by month
  const months = useMemo(() => {
    const out: { month: string; items: MySpill[] }[] = [];
    for (const s of list ?? []) {
      const m = fmtMonth(s.day);
      if (out[out.length - 1]?.month !== m) out.push({ month: m, items: [] });
      out[out.length - 1].items.push(s);
    }
    return out;
  }, [list]);

  return (
    <main className="mx-auto max-w-md px-5 pt-5 pb-28 lg:max-w-3xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2">
        <Link href="/profile" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="font-display text-[30px] leading-tight font-semibold">My Spills</h1>
      </header>
      <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
        <Lock size={14} className="shrink-0" /> Only you can see these. People only ever see a mask name.
      </p>

      {/* Your numbers */}
      {!!stats?.total && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Spilled" value={stats.total.toLocaleString()} />
          <Stat label="Streak" value={`${stats.streak ?? 0}`} note="days" flame />
          <Stat label="Longest" value={`${stats.longest ?? 0}`} note="days" />
          <Stat label="With most people" value={`${stats.majority ?? 0}%`} />
        </div>
      )}

      {/* Search and filters */}
      <div className="sticky top-0 z-10 -mx-5 mt-4 bg-cream/95 px-5 pt-2 pb-3 backdrop-blur lg:mx-0 lg:px-0">
        <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 text-muted">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your Spills" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="grid h-7 w-7 place-items-center rounded-full bg-cream">
              <X size={14} />
            </button>
          )}
        </label>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              ["", "All"],
              ["voice", "With my voice"],
              ["minority", "I was in the minority"],
            ] as [SpillFilter, string][]
          ).map(([f, label]) => (
            <button
              key={f || "all"}
              type="button"
              onClick={() => {
                tapFeedback();
                setFilter(f);
              }}
              className={clsx("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", filter === f ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list === null ? (
        <p className="py-10 text-center text-[14px] text-muted">Loading…</p>
      ) : !list.length ? (
        <p className="py-10 text-center text-[14px] text-muted">
          {search ? "No Spills match that." : filter === "voice" ? "You haven't added your voice to a Spill yet." : filter === "minority" ? "You've always picked what most people picked." : "You haven't spilled yet. Today's Spill is on Home."}
        </p>
      ) : (
        months.map((m) => (
          <section key={m.month} className="mt-3">
            <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {m.month} <span className="font-medium normal-case">· {m.items.length}{more && m === months[months.length - 1] ? "+" : ""}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {m.items.map((s) => (
                <SpillRow key={s.id} s={s} playing={playing === `spill-${s.id}`} demo={demo} />
              ))}
            </ul>
          </section>
        ))
      )}
      <div ref={tail} className="h-10" />
      {loading && list !== null && <p className="text-center text-[13px] text-muted">Loading older ones…</p>}
    </main>
  );
}

function Stat({ label, value, note, flame }: { label: string; value: string; note?: string; flame?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1 text-[20px] font-extrabold">
        {flame && <Flame size={16} className="self-center fill-[#ff9a3d] text-[#ff9a3d]" aria-hidden />}
        {value}
        {note && <span className="text-[12px] font-semibold text-muted">{note}</span>}
      </p>
    </div>
  );
}

function SpillRow({ s, playing, demo }: { s: MySpill; playing: boolean; demo?: boolean }) {
  const label = s.options.find((o) => o.id === s.choice)?.label ?? s.choice;
  const pct = s.total ? Math.round((s.same / s.total) * 100) : 0;
  const minority = s.top != null && s.same < s.top;
  return (
    <li className="rounded-2xl border border-line bg-surface p-3 shadow-card">
      <p className="text-[12px] font-semibold text-muted">{fmtDay(s.day)}</p>
      <p className="text-[15px] leading-snug font-semibold">{s.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-bold text-brand">{label}</span>
        <span className="text-muted">{pct}% agreed</span>
        {minority && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11.5px] font-bold text-[#8a5a00]">Minority</span>}
      </div>
      {s.key && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-cream px-2 py-1.5">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              if (!demo) playIntro(`spill-${s.id}`, voiceUrl(s.key) ?? undefined);
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-white"
            aria-label={playing ? "Pause your voice answer" : "Play your voice answer"}
          >
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
            Your voice{s.seconds ? ` · ${formatDuration(s.seconds)}` : ""}
            {s.style ? ` · ${STYLE_NAME[s.style] ?? s.style}` : ""}
          </span>
          <span className={clsx("shrink-0 text-[12px] font-semibold", s.hidden ? "text-chili" : "text-muted")}>
            {s.hidden ? "Hidden by Dashpad" : `${s.listens} ${s.listens === 1 ? "listen" : "listens"}`}
          </span>
        </div>
      )}
    </li>
  );
}
