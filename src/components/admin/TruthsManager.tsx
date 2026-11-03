"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Eye, EyeOff, Mic, Pause, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { TRUTH_KINDS, type TruthRow, type TruthStats } from "@/lib/truths";
import { deleteTruth, hideTruthVoice, saveTruth, setTruthHour, setTruthPush, truthVoices, type TruthVoiceRow } from "@/app/admin/(panel)/truths/actions";
import { voiceUrl } from "@/lib/voiceDisguise";
import { playIntro, usePlayingIntro } from "@/lib/voiceIntro";
import { AdminTitle } from "./AdminShell";

type Tab = "upcoming" | "past" | "nodate";
type Draft = { id?: number; body: string; options: string; kind: string; day: string; active: boolean };

const KIND_TONE: Record<string, string> = {
  light: "bg-mint-soft text-mint",
  real: "bg-brand-soft text-brand",
  spicy: "bg-chili-soft text-chili",
  deep: "bg-[#efe9fb] text-[#5b3fd9]",
  society: "bg-gold-soft text-[#8a5a00]",
};

const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Admin: the daily Truths. See what's coming, what people said, and change any of them */
export function TruthsManager({ rows, stats, today, hour, push, missing }: { rows: TruthRow[]; stats: TruthStats; today: string; hour: number; push?: boolean | null; missing?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [voices, setVoices] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => start(() => router.refresh());

  const groups = useMemo(() => {
    const upcoming = rows.filter((r) => r.day && r.day >= today);
    const past = rows.filter((r) => r.day && r.day < today).reverse();
    const nodate = rows.filter((r) => !r.day);
    return { upcoming, past, nodate };
  }, [rows, today]);
  const todays = rows.find((r) => r.day === today);
  const daysLeft = groups.upcoming.filter((r) => r.active).length + groups.nodate.filter((r) => r.active).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows : groups[tab];
    return q ? list.filter((r) => r.body.toLowerCase().includes(q) || r.options.some((o) => o.label.toLowerCase().includes(q))) : list;
  }, [rows, groups, tab, query]);

  async function remove(r: TruthRow) {
    if (!confirm(`Delete "${r.body}"?`)) return;
    const res = await deleteTruth(r.id);
    if (res.error) return setNote(res.error);
    refresh();
  }

  if (missing) {
    return (
      <>
        <AdminTitle title="Truths" />
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">Run update 115 in Supabase first. It adds the Truths and the first 365 questions.</p>
      </>
    );
  }

  return (
    <>
      <AdminTitle
        title="Truths"
        subtitle="One question a day for everyone. People answer, can add a masked voice, then see how everyone answered and wave at voices they like."
        action={
          <button type="button" onClick={() => setEditing("new")} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-4 text-[14px] font-bold text-white">
            <Plus size={18} /> Add a Truth
          </button>
        }
      />

      {/* Today, and how long the list lasts */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-[#1a1233] p-4 text-white sm:col-span-2">
          <p className="text-[11px] font-extrabold tracking-wide text-gold">TODAY&apos;S TRUTH</p>
          <p className="mt-1 font-display text-[19px] leading-snug font-semibold">{todays?.body ?? "Nothing set for today. The next one without a date goes out."}</p>
          {todays && <Split row={todays} stats={stats} dark />}
        </div>
        <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px] font-semibold text-muted">Questions left</p>
          <p className={clsx("text-[28px] font-extrabold", daysLeft < 30 ? "text-chili" : "text-ink")}>{daysLeft}</p>
          <p className="text-[12.5px] text-muted">{daysLeft < 30 ? "Add more soon, they're running out." : "That's about " + Math.floor(daysLeft / 30) + " months."}</p>
          <HourPicker hour={hour} onSaved={refresh} />
          <PushToggle on={push ?? null} onSaved={refresh} />
        </div>
      </div>

      {note && <p className="mb-3 text-[13px] font-semibold text-chili">{note}</p>}

      {editing === "new" && (
        <Editor
          draft={{ body: "", options: "Yes\nNo", kind: "real", day: "", active: true }}
          answered={0}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["upcoming", `Coming up · ${groups.upcoming.length}`],
            ["past", `Past · ${groups.past.length}`],
            ["nodate", `No date · ${groups.nodate.length}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
            className={clsx("h-10 rounded-full px-4 text-[13.5px] font-bold", tab === t && !query ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft")}
          >
            {label}
          </button>
        ))}
        <label className="flex h-10 w-full items-center sm:ml-auto sm:w-auto sm:min-w-[220px] gap-2 rounded-full border border-line bg-surface px-3.5 text-muted">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all Truths" className="w-full bg-transparent text-[14px] text-ink outline-none" />
        </label>
      </div>

      <ul className="flex flex-col gap-2.5">
        {shown.slice(0, 400).map((r) =>
          editing === r.id ? (
            <li key={r.id}>
              <Editor
                draft={{ id: r.id, body: r.body, options: r.options.map((o) => o.label).join("\n"), kind: r.kind, day: r.day ?? "", active: r.active }}
                answered={stats[r.id]?.total ?? 0}
                onDone={() => {
                  setEditing(null);
                  refresh();
                }}
              />
            </li>
          ) : (
            <li key={r.id} className={clsx("rounded-3xl border bg-surface p-3.5 shadow-card", r.day === today ? "border-brand" : "border-line", !r.active && "opacity-55")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 sm:flex sm:gap-3">
                <div className="flex shrink-0 items-center gap-2 sm:block sm:w-[92px]">
                  <p className={clsx("text-[12.5px] font-bold", r.day === today ? "text-brand" : "text-ink-soft")}>{r.day === today ? "Today" : r.day ? fmtDay(r.day) : "No date"}</p>
                  <span className={clsx("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase sm:mt-1", KIND_TONE[r.kind] ?? "bg-cream text-muted")}>{TRUTH_KINDS[r.kind] ?? r.kind}</span>
                </div>
                <div className="mt-1 min-w-0 flex-1 sm:mt-0">
                  <p className="text-[15px] font-bold">{r.body}</p>
                  {stats[r.id]?.total ? (
                    <Split row={r} stats={stats} />
                  ) : (
                    <p className="mt-1 text-[12.5px] text-muted">
                      {!r.active ? "Hidden · " : ""}
                      {r.options.map((o) => o.label).join(" / ")}
                    </p>
                  )}
                </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!!stats[r.id]?.voices && (
                    <button
                      type="button"
                      onClick={() => setVoices(voices === r.id ? null : r.id)}
                      className={clsx("inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12.5px] font-bold", voices === r.id ? "bg-ink text-white" : "bg-cream text-ink-soft")}
                    >
                      <Mic size={14} /> {stats[r.id].voices}
                    </button>
                  )}
                  <IconBtn label="Edit" onClick={() => setEditing(r.id)}>
                    <Pencil size={16} />
                  </IconBtn>
                  {!stats[r.id]?.total && (
                    <IconBtn label="Delete" onClick={() => void remove(r)}>
                      <Trash2 size={16} />
                    </IconBtn>
                  )}
                </div>
              </div>
              {voices === r.id && <Voices truth={r} />}
            </li>
          ),
        )}
      </ul>
      {!shown.length && <p className="py-10 text-center text-[14px] text-muted">{query ? "No Truths match that." : "Nothing here."}</p>}
    </>
  );
}

/** How people answered, as a thin bar per answer */
function Split({ row, stats, dark }: { row: TruthRow; stats: TruthStats; dark?: boolean }) {
  const s = stats[row.id];
  if (!s?.total) return dark ? <p className="mt-2 text-[12.5px] text-white/60">No answers yet</p> : null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {row.options.map((o) => {
        const p = pct(s.counts[o.id] ?? 0, s.total);
        return (
          <div key={o.id} className="flex items-center gap-2 text-[12.5px]">
            <span className={clsx("w-[90px] shrink-0 truncate font-semibold sm:w-[110px]", dark ? "text-white/85" : "text-ink-soft")}>{o.label}</span>
            <span className={clsx("h-2 flex-1 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-cream")}>
              <span className="block h-full rounded-full bg-gold" style={{ width: `${p}%` }} />
            </span>
            <span className={clsx("w-9 text-right font-bold", dark ? "text-white" : "text-ink")}>{p}%</span>
          </div>
        );
      })}
      <p className={clsx("text-[12px]", dark ? "text-white/60" : "text-muted")}>
        {s.total.toLocaleString()} answered · {s.voices} voice{s.voices === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/** The voice answers on a Truth: listen, and hide any that break the rules */
function Voices({ truth }: { truth: TruthRow }) {
  const [list, setList] = useState<TruthVoiceRow[] | null>(null);
  const playing = usePlayingIntro();
  useEffect(() => {
    void truthVoices(truth.id).then(setList);
  }, [truth.id]);
  if (list === null) return <p className="mt-3 text-[13px] text-muted">Loading voices…</p>;
  async function toggle(v: TruthVoiceRow) {
    const r = await hideTruthVoice(v.id, !v.hidden);
    if (!r.error) setList((l) => (l ?? []).map((x) => (x.id === v.id ? { ...x, hidden: !v.hidden } : x)));
  }
  return (
    <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
      {list.map((v) => {
        const id = `admin-truth-${v.id}`;
        return (
          <li key={v.id} className={clsx("flex items-center gap-2.5 rounded-2xl bg-cream px-3 py-2", v.hidden && "opacity-50")}>
            <button type="button" onClick={() => playIntro(id, voiceUrl(v.voice_key) ?? undefined)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white" aria-label="Play">
              {playing === id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
            </button>
            <span className="min-w-0 flex-1 truncate text-[13.5px]">
              <b>{v.alias}</b> · {truth.options.find((o) => o.id === v.choice)?.label ?? v.choice} · {v.voice_seconds ?? 0}s · {v.listens} listens
            </span>
            <button type="button" onClick={() => void toggle(v)} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[12.5px] font-bold text-ink-soft">
              {v.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {v.hidden ? "Show" : "Hide"}
            </button>
          </li>
        );
      })}
      {!list.length && <li className="text-[13px] text-muted">No voice answers.</li>}
    </ul>
  );
}

/** The "Today's Truth is up" notification, sent when each new Truth starts */
function PushToggle({ on, onSaved }: { on: boolean | null; onSaved: () => void }) {
  const [v, setV] = useState(on);
  if (v === null) return <p className="mt-2 text-[12px] text-muted">Run update 116 to send a notification when each Truth goes up.</p>;
  return (
    <label className="mt-2 flex items-center gap-2 text-[12.5px] font-semibold text-muted">
      <input
        type="checkbox"
        checked={v}
        onChange={async (e) => {
          const next = e.target.checked;
          setV(next);
          const r = await setTruthPush(next);
          if (r.error) setV(!next);
          else onSaved();
        }}
        className="h-5 w-5 accent-brand"
      />
      Send a notification when it goes up
    </label>
  );
}

function HourPicker({ hour, onSaved }: { hour: number; onSaved: () => void }) {
  const [h, setH] = useState(hour);
  const label = (n: number) => (n === 0 ? "12am" : n < 12 ? `${n}am` : n === 12 ? "12pm" : `${n - 12}pm`);
  return (
    <label className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-muted">
      New Truth at
      <select
        value={h}
        onChange={async (e) => {
          const n = Number(e.target.value);
          setH(n);
          const r = await setTruthHour(n);
          if (!r.error) onSaved();
        }}
        className="h-9 rounded-xl border border-line bg-cream px-2 text-[13.5px] font-bold text-ink"
      >
        {Array.from({ length: 24 }, (_, n) => (
          <option key={n} value={n}>
            {label(n)}
          </option>
        ))}
      </select>
      Lagos
    </label>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full bg-cream text-ink-soft transition hover:bg-line">
      {children}
    </button>
  );
}

function Editor({ draft, answered, onDone }: { draft: Draft; answered: number; onDone: () => void }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const options = d.options.split("\n").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await saveTruth({ id: d.id, body: d.body, options, kind: d.kind, day: d.day || null, active: d.active });
    setBusy(false);
    if (r.error) return setErr(r.error);
    onDone();
  }

  const field = "mt-1 w-full rounded-2xl border border-line bg-cream px-3.5 text-[15px] text-ink outline-none focus:border-brand";
  return (
    <div className="mb-2.5 rounded-3xl border-2 border-brand/30 bg-surface p-4 shadow-card">
      {/* How it looks on Home */}
      <div className="rounded-[22px] bg-[#1a1233] p-4 text-white">
        <span className="rounded-full bg-gold px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-[#1a1233]">TODAY&apos;S TRUTH</span>
        <p className="mt-2 font-display text-[19px] leading-snug font-semibold">{d.body || "Would you date someone who earns less than you?"}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {options.slice(0, 4).map((o) => (
            <span key={o} className="rounded-xl bg-white/12 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/20">{o}</span>
          ))}
        </div>
      </div>
      <label className="mt-4 block text-[13px] font-semibold text-muted">
        Question
        <textarea value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={160} rows={2} placeholder="Would you date someone who earns less than you?" className={clsx(field, "py-2.5")} />
      </label>
      <label className="mt-3 block text-[13px] font-semibold text-muted">
        Answers (2 to 4, one per line)
        <textarea value={d.options} onChange={(e) => set({ options: e.target.value })} rows={3} className={clsx(field, "py-2.5")} />
        {answered > 0 && <span className="mt-1 block text-[12px] text-muted">{answered} people answered this, so you can rename answers but not remove them.</span>}
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold text-muted">
          Date
          <input type="date" value={d.day} onChange={(e) => set({ day: e.target.value })} className={clsx(field, "h-12")} />
          <span className="mt-1 block text-[12px]">Leave empty to use it when the dated ones run out. A taken date swaps the two.</span>
        </label>
        <label className="block text-[13px] font-semibold text-muted">
          Kind
          <select value={d.kind} onChange={(e) => set({ kind: e.target.value })} className={clsx(field, "h-12")}>
            {Object.entries(TRUTH_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[14px] font-semibold">
        <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} className="h-5 w-5 accent-brand" />
        On (people can get this one)
      </label>
      {err && <p className="mt-3 text-[13px] font-semibold text-chili">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className="h-11 rounded-2xl bg-brand px-5 text-[14px] font-bold text-white disabled:opacity-50">
          {busy ? "Saving…" : d.id ? "Save" : "Add Truth"}
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-2xl border border-line px-5 text-[14px] font-bold text-ink-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}
