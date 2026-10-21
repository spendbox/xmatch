"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarPlus, ChevronRight, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { plural } from "@/lib/plural";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { addPromptsBulk, deletePrompt, savePrompt, swapPromptDays, type AdminPrompt } from "@/app/admin/(panel)/prompts/actions";
import { AdminTitle } from "./AdminShell";

function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return new Date(day + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

type Draft = { id?: string; body: string; day: string; chat_cost: number };

export function PromptManager({ prompts, today }: { prompts: AdminPrompt[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const byDay = useMemo(() => new Map(prompts.map((p) => [p.day, p])), [prompts]);
  const upcoming = prompts.filter((p) => p.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const past = prompts.filter((p) => p.day < today).sort((a, b) => b.day.localeCompare(a.day));
  const week = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const firstFree = week.find((d) => !byDay.has(d)) ?? addDays(upcoming[upcoming.length - 1]?.day ?? today, 1);
  const lastCost = upcoming[upcoming.length - 1]?.chat_cost ?? prompts[0]?.chat_cost ?? 5;
  const scheduledAhead = (() => {
    let n = 0;
    while (byDay.has(addDays(today, n))) n++;
    return n;
  })();

  const refresh = () => start(() => router.refresh());

  async function save(d: Draft) {
    setError(null);
    const r = await savePrompt(d);
    if (r.error) return setError(r.error);
    setDraft(null);
    setNotice(d.id ? "Saved." : `Scheduled for ${dayLabel(d.day, today)}.`);
    refresh();
  }

  async function remove(p: AdminPrompt) {
    if (!confirm(p.answers ? `Delete this prompt and its ${plural(p.answers, "answer")}? This can't be undone.` : "Delete this prompt?")) return;
    await deletePrompt(p.id);
    refresh();
  }

  async function move(p: AdminPrompt, dir: -1 | 1) {
    const i = upcoming.findIndex((x) => x.id === p.id);
    const other = upcoming[i + dir];
    if (!other || other.day === today || p.day === today) return;
    await swapPromptDays(p.id, other.id);
    refresh();
  }

  return (
    <>
      <AdminTitle
        title="Daily prompts"
        subtitle="One question for everyone each day. It changes at midnight (Lagos time)."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setBulk(true);
                setDraft(null);
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold"
            >
              <ListPlus size={17} /> Add many
            </button>
            <button
              onClick={() => {
                setBulk(false);
                setError(null);
                setDraft({ body: "", day: firstFree, chat_cost: lastCost });
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white"
            >
              <Plus size={17} /> New prompt
            </button>
          </div>
        }
      />

      {scheduledAhead < 2 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-chili/30 bg-chili-soft p-4 text-chili">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-[14px] font-semibold">
            {scheduledAhead === 0 ? "There's no prompt today. The Feed is empty for everyone." : "Tomorrow has no prompt yet. Add one so the Feed doesn't go quiet."}
          </p>
        </div>
      )}

      {/* Next two weeks at a glance */}
      <section className="rounded-3xl border border-line bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Next 14 days</h2>
          <span className="text-[13px] text-muted">{scheduledAhead > 0 ? `Covered for ${plural(scheduledAhead, "day")}` : "Nothing scheduled"}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const p = byDay.get(d);
            const dt = new Date(d + "T12:00:00Z");
            return (
              <button
                key={d}
                onClick={() => {
                  setBulk(false);
                  setError(null);
                  setDraft(p ? { id: p.id, body: p.body, day: p.day, chat_cost: p.chat_cost } : { body: "", day: d, chat_cost: lastCost });
                }}
                title={p ? p.body : "Add a prompt"}
                className={clsx(
                  "flex flex-col items-center rounded-xl py-2 text-[11px] font-semibold transition",
                  p ? "bg-brand-soft text-brand hover:bg-brand/15" : "border border-dashed border-chili/50 text-chili hover:bg-chili-soft",
                  d === today && "ring-2 ring-brand",
                )}
              >
                <span className="uppercase opacity-70">{dt.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</span>
                <span className="text-[16px]">{dt.getUTCDate()}</span>
                {p ? <span className="h-1.5 w-1.5 rounded-full bg-brand" /> : <Plus size={11} />}
              </button>
            );
          })}
        </div>
      </section>

      {notice && (
        <p className="mt-4 flex items-center justify-between rounded-2xl bg-mint-soft px-4 py-3 text-[14px] font-semibold text-mint">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </p>
      )}

      {draft && <Editor draft={draft} today={today} error={error} onCancel={() => setDraft(null)} onSave={save} />}
      {bulk && (
        <BulkAdd
          from={firstFree}
          cost={lastCost}
          onCancel={() => setBulk(false)}
          onDone={(n, last) => {
            setBulk(false);
            setNotice(`Scheduled ${plural(n, "prompt")}, up to ${dayLabel(last, today)}.`);
            refresh();
          }}
        />
      )}

      <h2 className="mt-8 mb-3 text-[18px] font-semibold">Coming up</h2>
      {upcoming.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-[14px] text-muted">No prompts scheduled. Add a few so the Feed always has a question.</p>
      ) : (
        <ul className={clsx("space-y-2.5 transition", pending && "opacity-60")}>
          {upcoming.map((p, i) => (
            <PromptRow
              key={p.id}
              p={p}
              today={today}
              onEdit={() => {
                setBulk(false);
                setError(null);
                setDraft({ id: p.id, body: p.body, day: p.day, chat_cost: p.chat_cost });
              }}
              onDelete={() => remove(p)}
              onUp={p.day !== today && i > 0 && upcoming[i - 1].day !== today ? () => move(p, -1) : undefined}
              onDown={p.day !== today && i < upcoming.length - 1 ? () => move(p, 1) : undefined}
            />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-[18px] font-semibold">Past prompts</h2>
          <ul className="space-y-2.5">
            {past.map((p) => (
              <PromptRow key={p.id} p={p} today={today} onDelete={() => remove(p)} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function PromptRow({
  p,
  today,
  onEdit,
  onDelete,
  onUp,
  onDown,
}: {
  p: AdminPrompt;
  today: string;
  onEdit?: () => void;
  onDelete: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const live = p.day === today;
  return (
    <li className={clsx("rounded-3xl border bg-surface p-4 shadow-card", live ? "border-brand" : "border-line")}>
      <div className="flex items-start gap-3">
        <div className="w-24 shrink-0">
          <p className={clsx("text-[13px] font-semibold", live ? "text-brand" : "text-ink")}>{dayLabel(p.day, today)}</p>
          {live && <span className="mt-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white uppercase">Live now</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-medium">{p.body}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              Chat: {p.chat_cost ? <><KeyCoin size={12} /> {p.chat_cost}</> : "free"}
            </span>
            {(p.day <= today || p.answers > 0) && (
              <>
                <span>{plural(p.answers, "answer")}</span>
                <span>{plural(p.reactions, "reaction")}</span>
                <span>{plural(p.gifts, "gift")}</span>
                <span>{plural(p.chats, "chat")}</span>
                {p.reports > 0 && <span className="font-semibold text-chili">{plural(p.reports, "report")}</span>}
                {p.hidden > 0 && <span>{p.hidden} hidden</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onUp && (
            <IconBtn label="Move earlier" onClick={onUp}>
              <ArrowUp size={16} />
            </IconBtn>
          )}
          {onDown && (
            <IconBtn label="Move later" onClick={onDown}>
              <ArrowDown size={16} />
            </IconBtn>
          )}
          {onEdit && (
            <IconBtn label="Edit" onClick={onEdit}>
              <Pencil size={16} />
            </IconBtn>
          )}
          <IconBtn label="Delete" onClick={onDelete} danger>
            <Trash2 size={16} />
          </IconBtn>
        </div>
      </div>
      {p.answers > 0 && (
        <Link href={`/admin/prompts/${p.id}`} className="mt-3 flex items-center justify-between rounded-2xl bg-cream px-3.5 py-2.5 text-[13px] font-semibold hover:bg-line/50">
          See and moderate answers <ChevronRight size={16} />
        </Link>
      )}
    </li>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx("grid h-9 w-9 place-items-center rounded-full text-muted transition", danger ? "hover:bg-chili-soft hover:text-chili" : "hover:bg-cream hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Editor({ draft, today, error, onCancel, onSave }: { draft: Draft; today: string; error: string | null; onCancel: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-5 animate-fade-up rounded-3xl border border-brand bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <CalendarPlus size={18} className="text-brand" /> {d.id ? "Edit prompt" : "New prompt"}
        </h2>
        <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-cream" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <textarea
        value={d.body}
        onChange={(e) => setD({ ...d, body: e.target.value.slice(0, 300) })}
        rows={3}
        autoFocus
        placeholder="e.g. What's the most toxic thing you find attractive?"
        className="w-full resize-none rounded-2xl border border-line-strong bg-cream px-4 py-3 text-[16px] outline-none focus:border-brand"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-semibold text-ink-soft">Day {d.day ? `(${dayLabel(d.day, today)})` : ""}</span>
          <input
            type="date"
            value={d.day}
            min={d.id ? undefined : today}
            onChange={(e) => setD({ ...d, day: e.target.value })}
            className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-ink-soft">Keys to start a chat (0 = free)</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={d.chat_cost}
            onChange={(e) => setD({ ...d, chat_cost: Number(e.target.value) })}
            className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-brand"
          />
        </label>
      </div>
      {error && <p className="mt-3 rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-cream">
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            await onSave(d);
            setBusy(false);
          }}
          disabled={busy || d.body.trim().length < 3}
          className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : d.id ? "Save" : "Schedule"}
        </button>
      </div>
    </section>
  );
}

function BulkAdd({ from, cost, onCancel, onDone }: { from: string; cost: number; onCancel: () => void; onDone: (n: number, last: string) => void }) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(from);
  const [c, setC] = useState(cost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = text.split("\n").filter((l) => l.trim().length >= 3).length;
  return (
    <section className="mt-5 animate-fade-up rounded-3xl border border-brand bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <ListPlus size={18} className="text-brand" /> Add many prompts
        </h2>
        <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-cream" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <p className="mb-3 text-[13px] text-muted">One prompt per line. Each goes on the next free day, in order, starting from the date below.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"Your most toxic trait?\nWhat's a green flag nobody talks about?\nDescribe your ideal Sunday in 5 words"}
        className="w-full resize-y rounded-2xl border border-line-strong bg-cream px-4 py-3 text-[15px] outline-none focus:border-brand"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-semibold text-ink-soft">Start from</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-brand" />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-ink-soft">Keys to start a chat (0 = free)</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={c}
            onChange={(e) => setC(Number(e.target.value))}
            className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-brand"
          />
        </label>
      </div>
      {error && <p className="mt-3 rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-cream">
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await addPromptsBulk(text, start, c);
            setBusy(false);
            if (r.error) return setError(r.error);
            onDone(r.added, r.last ?? start);
          }}
          disabled={busy || !count}
          className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Scheduling…" : `Schedule ${count || ""} ${count === 1 ? "prompt" : "prompts"}`}
        </button>
      </div>
    </section>
  );
}
