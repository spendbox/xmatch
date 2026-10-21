"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Eye, EyeOff, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { addIcebreakersBulk, bulkIcebreakers, deleteIcebreaker, updateIcebreaker, type Icebreaker } from "@/app/admin/(panel)/actions";
import { parseIcebreakers } from "@/lib/icebreakerImport";
import { Upload } from "lucide-react";
import { SPICE_LEVELS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { SpiceIcon } from "@/components/ui/icons";
import { AdminTitle } from "./AdminShell";

const TONES = ["bg-mint-soft text-mint", "bg-chili-soft text-chili", "bg-chili-soft text-chili", "bg-[#f6e6f8] text-[#b42da8]"];

export function IcebreakerManager({ initial }: { initial: Icebreaker[] }) {
  const [items, setItems] = useState(initial);
  const [level, setLevel] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [showOff, setShowOff] = useState(true);
  const [addLevel, setAddLevel] = useState(1);
  const [addText, setAddText] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Thousands of rows are slow to draw, so show them a page at a time
  const [visible, setVisible] = useState(200);
  useEffect(() => setVisible(200), [level, query, showOff]);
  const [bulkPending, startBulk] = useTransition();
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => [0, 1, 2, 3].map((l) => items.filter((i) => i.spice === l && i.active).length), [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (level === "all" || i.spice === level) && (showOff || i.active) && (!q || i.body.toLowerCase().includes(q)),
    );
  }, [items, level, query, showOff]);
  const parsed = useMemo(() => parseIcebreakers(addText, addLevel), [addText, addLevel]);
  const perLevel = [0, 1, 2, 3].map((l) => parsed.filter((p) => p.spice === l).length);
  const lines = parsed.length;

  function add() {
    setNote(null);
    start(async () => {
      const res = await addIcebreakersBulk(parsed);
      if (res.error) return setNote({ ok: false, text: res.error });
      setItems((list) => [...res.added, ...list]);
      setAddText("");
      const n = res.added.length;
      setNote({ ok: true, text: `Added ${n} question${n === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} already existed` : ""}.` });
    });
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) return setNote({ ok: false, text: "That file is too big (2 MB max)." });
    const text = await file.text();
    setAddText((t) => (t.trim() ? t.trimEnd() + "\n" : "") + text);
  }

  function toggleSelect(id: number, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function runBulk(op: "hide" | "show" | "delete") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (op === "delete" && !confirm(`Delete ${ids.length === 1 ? "this question" : `these ${ids.length} questions`}? This can't be undone.`)) return;
    setBulkNote(null);
    startBulk(async () => {
      const res = await bulkIcebreakers(ids, op);
      if ("error" in res && res.error) return setBulkNote(res.error);
      const set = new Set(ids);
      setItems((list) =>
        op === "delete" ? list.filter((x) => !set.has(x.id)) : list.map((x) => (set.has(x.id) ? { ...x, active: op === "show" } : x)),
      );
      setSelected(new Set());
      setBulkNote(`${ids.length === 1 ? "1 question" : `${ids.length} questions`} ${op === "delete" ? "deleted" : op === "hide" ? "hidden" : "shown"}.`);
    });
  }

  function patch(id: number, p: Partial<Icebreaker>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  return (
    <>
      <AdminTitle title="Icebreakers" subtitle={`${counts.reduce((a, b) => a + b, 0)} active questions. They're picked by the average of both people's spice choices.`} />

      {/* Level summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SPICE_LEVELS.map((s) => (
          <button
            key={s.value}
            onClick={() => setLevel(level === s.value ? "all" : s.value)}
            className={clsx(
              "flex items-center gap-3 rounded-3xl border bg-surface p-4 text-left shadow-card transition",
              level === s.value ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-line-strong",
            )}
          >
            <span className={clsx("grid h-11 w-11 place-items-center rounded-xl", TONES[s.value])}>
              <SpiceIcon level={s.value} size={22} />
            </span>
            <span>
              <span className="block font-display text-[24px] leading-none font-semibold">{counts[s.value]}</span>
              <span className="text-[13px] text-muted">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Add in bulk */}
        <section className="h-fit rounded-3xl border border-line bg-surface p-5 shadow-card lg:sticky lg:top-8 lg:col-span-4">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold"><Plus size={18} /> Bulk add questions</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            One question per line, as many as you like. Pick a level below, or set it per line like <b className="text-ink-soft">Naughty: …</b> or with a heading line such as <b className="text-ink-soft">Spicy</b>. Duplicates are skipped.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SPICE_LEVELS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setAddLevel(s.value)}
                className={clsx(
                  "flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold",
                  addLevel === s.value ? "border-brand bg-brand-soft text-brand-ink" : "border-line",
                )}
              >
                <SpiceIcon level={s.value} size={16} /> {s.label}
              </button>
            ))}
          </div>
          <Textarea
            rows={9}
            className="mt-3 text-[15px]"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder={"What's your favourite way to spend a rainy day?\nWhat's a song that always gets you dancing?\n\nSpicy\nWhere's the best place for a first kiss?\nNaughty: What's your secret flirting weapon?"}
          />
          <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-brand">
            <Upload size={16} /> Upload a .txt or .csv file
            <input type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {lines > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
              {SPICE_LEVELS.map((sl) => (
                <div key={sl.value} className={clsx("rounded-xl py-2", perLevel[sl.value] ? TONES[sl.value] : "bg-cream text-muted")}>
                  <p className="text-[16px] leading-none font-bold">{perLevel[sl.value]}</p>
                  <p className="mt-1 text-[10px] font-semibold">{sl.short}</p>
                </div>
              ))}
            </div>
          )}
          {note && <p className={clsx("mt-3 rounded-xl px-3 py-2 text-[13px] font-medium", note.ok ? "bg-mint-soft text-mint" : "bg-chili-soft text-chili")}>{note.text}</p>}
          <Button size="lg" className="mt-3" onClick={add} disabled={!lines} loading={pending} loadingText="Adding…">
            Add {lines || ""} question{lines === 1 ? "" : "s"}
          </Button>
        </section>

        {/* List */}
        <section className="lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-brand">
              <Search size={17} className="text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
            </label>
            <div className="flex gap-1 rounded-2xl bg-surface p-1 shadow-card">
              {(["all", 0, 1, 2, 3] as const).map((l) => (
                <button
                  key={String(l)}
                  onClick={() => setLevel(l)}
                  className={clsx("h-9 rounded-xl px-3 text-[13px] font-semibold", level === l ? "bg-ink text-white" : "text-muted hover:text-ink")}
                >
                  {l === "all" ? "All" : SPICE_LEVELS[l].short}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} className="accent-brand" /> Show hidden
            </label>
          </div>

          {/* Select + bulk actions */}
          <div className="sticky top-2 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-card">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={shown.length > 0 && shown.every((i) => selected.has(i.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...shown.map((i) => i.id)]) : new Set())}
              />
              {selected.size ? `${selected.size} selected` : `Select all ${shown.length.toLocaleString()}`}
            </label>
            {selected.size > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button variant="secondary" className="h-9 px-3 text-[13px]" disabled={bulkPending} onClick={() => runBulk("hide")}>
                  <EyeOff size={15} /> Hide
                </Button>
                <Button variant="secondary" className="h-9 px-3 text-[13px]" disabled={bulkPending} onClick={() => runBulk("show")}>
                  <Eye size={15} /> Show
                </Button>
                <Button variant="danger" className="h-9 px-3 text-[13px]" loading={bulkPending} loadingText="Working…" onClick={() => runBulk("delete")}>
                  <Trash2 size={15} /> Delete
                </Button>
                <button onClick={() => setSelected(new Set())} className="h-9 rounded-xl px-2 text-[13px] font-medium text-muted hover:text-ink">Clear</button>
              </div>
            )}
          </div>
          {bulkNote && <p className="mb-2 rounded-xl bg-mint-soft px-3 py-2 text-[13px] font-medium text-mint">{bulkNote}</p>}
          <ul className="space-y-2">
            {shown.slice(0, visible).map((i) => (
              <Row
                key={i.id}
                item={i}
                selected={selected.has(i.id)}
                onSelect={(on) => toggleSelect(i.id, on)}
                onChange={(p) => patch(i.id, p)}
                onDeleted={() => setItems((l) => l.filter((x) => x.id !== i.id))}
              />
            ))}
            {!shown.length && <li className="rounded-2xl bg-surface p-6 text-center text-[14px] text-muted">No questions match.</li>}
          </ul>
          {shown.length > visible && (
            <button
              onClick={() => setVisible((v) => v + 300)}
              className="mt-3 h-11 w-full rounded-2xl border border-line-strong bg-surface text-[14px] font-semibold hover:bg-cream"
            >
              Show more ({(shown.length - visible).toLocaleString()} left)
            </button>
          )}
        </section>
      </div>
    </>
  );
}

function Row({
  item, selected, onSelect, onChange, onDeleted,
}: {
  item: Icebreaker;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onChange: (p: Partial<Icebreaker>) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const [spice, setSpice] = useState(item.spice);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateIcebreaker(item.id, { body, spice });
      if ("error" in res && res.error) return setError(res.error);
      onChange({ body: body.replace(/\s+/g, " ").trim(), spice });
      setEditing(false);
      setError(null);
    });
  }
  function toggle(v: boolean) {
    onChange({ active: v });
    start(async () => {
      const res = await updateIcebreaker(item.id, { active: v });
      if ("error" in res && res.error) onChange({ active: !v });
    });
  }
  function remove() {
    if (!confirm("Delete this question?")) return;
    start(async () => {
      const res = await deleteIcebreaker(item.id);
      if ("ok" in res) onDeleted();
    });
  }

  return (
    <li
      className={clsx(
        "rounded-2xl border bg-surface p-3.5 transition",
        selected ? "border-brand ring-2 ring-brand/20" : item.active ? "border-line" : "border-dashed border-line-strong",
        !item.active && !selected && "opacity-60",
      )}
    >
      {editing ? (
        <div className="space-y-2">
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="text-[15px]" autoFocus />
          <div className="flex flex-wrap items-center gap-2">
            <select value={spice} onChange={(e) => setSpice(Number(e.target.value))} className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-[14px]">
              {SPICE_LEVELS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Button className="h-10" onClick={save} loading={pending} loadingText="Saving…"><Check size={16} /> Save</Button>
            <Button className="h-10" variant="ghost" onClick={() => { setEditing(false); setBody(item.body); setSpice(item.spice); }}><X size={16} /> Cancel</Button>
            {error && <span className="text-[13px] text-chili">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-2 h-4 w-4 shrink-0 accent-brand"
            aria-label="Select question"
          />
          <span className={clsx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONES[item.spice])} title={SPICE_LEVELS[item.spice].label}>
            <SpiceIcon level={item.spice} size={16} />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-[15px] leading-snug">{item.body}</p>
          <div className="flex shrink-0 items-center gap-1">
            <Toggle checked={item.active} onChange={toggle} label={item.active ? "Switch off" : "Switch on"} />
            <button onClick={() => setEditing(true)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-cream hover:text-ink" aria-label="Edit"><Pencil size={16} /></button>
            <button onClick={remove} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-chili-soft hover:text-chili" aria-label="Delete"><Trash2 size={16} /></button>
          </div>
        </div>
      )}
    </li>
  );
}
