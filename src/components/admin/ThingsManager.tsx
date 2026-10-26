"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { NEEDED, TONES, type ThingPromptRow } from "@/lib/things";
import { moveThingPrompt, saveThingPrompt } from "@/app/admin/(panel)/things/actions";
import { AdminTitle } from "./AdminShell";

const TONE_NAMES = Object.keys(TONES) as (keyof typeof TONES)[];
type Draft = { id?: string; text: string; ideas: string; tone: string; repeatable: boolean; active: boolean };

/** Admin: the "Things about you" cards people answer to set up their profile */
export function ThingsManager({ rows, counts, missing }: { rows: ThingPromptRow[]; counts: Record<string, number>; missing?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const live = rows.filter((r) => r.active);
  const short = live.filter((r) => !r.repeatable).length < NEEDED;

  async function move(id: string, dir: -1 | 1) {
    const r = await moveThingPrompt(id, dir);
    if (r.error) setNote(r.error);
    start(() => router.refresh());
  }

  return (
    <>
      <AdminTitle
        title="Profile questions"
        subtitle={`The "Things about you" cards. People answer ${NEEDED} to finish their profile, in this order. Changes apply right away.`}
        action={
          !missing && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-4 text-[14px] font-bold text-white"
            >
              <Plus size={18} /> Add a question
            </button>
          )
        }
      />

      {missing ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">
          Run update 82 in Supabase first. Until then people see the built-in questions.
        </p>
      ) : (
        <>
          {short && (
            <p className="mb-4 rounded-2xl bg-gold-soft px-4 py-3 text-[14px] font-semibold text-[#8a5a00]">
              Fewer than {NEEDED} questions are on, so people will fill the rest with the ones they can answer more than once.
            </p>
          )}
          {note && <p className="mb-4 text-[13px] font-semibold text-chili">{note}</p>}
          {editing === "new" && (
            <Editor
              draft={{ text: "", ideas: "", tone: "violet", repeatable: false, active: true }}
              onDone={() => {
                setEditing(null);
                start(() => router.refresh());
              }}
            />
          )}
          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) =>
              editing === r.id ? (
                <li key={r.id}>
                  <Editor
                    draft={{ id: r.id, text: r.text, ideas: (r.ideas ?? []).join("\n"), tone: r.tone, repeatable: r.repeatable, active: r.active }}
                    onDone={() => {
                      setEditing(null);
                      start(() => router.refresh());
                    }}
                  />
                </li>
              ) : (
                <li
                  key={r.id}
                  className={clsx("flex items-center gap-3 rounded-3xl border border-line bg-surface p-3 shadow-card", !r.active && "opacity-55")}
                >
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[13px] font-extrabold text-white"
                    style={{ background: TONES[r.tone as keyof typeof TONES] ?? TONES.violet }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{r.text}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      {!r.active ? "Hidden · " : ""}
                      {r.repeatable ? "Can answer more than once · " : ""}
                      {(counts[r.id] ?? 0).toLocaleString()} answered
                      {r.ideas?.length ? ` · ${r.ideas.slice(0, 3).join(", ")}${r.ideas.length > 3 ? "…" : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => void move(r.id, -1)}>
                      <ArrowUp size={16} />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={i === rows.length - 1} onClick={() => void move(r.id, 1)}>
                      <ArrowDown size={16} />
                    </IconBtn>
                    <IconBtn label="Edit" onClick={() => setEditing(r.id)}>
                      <Pencil size={16} />
                    </IconBtn>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-full bg-cream text-ink-soft transition hover:bg-line disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Editor({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await saveThingPrompt({ ...d, ideas: d.ideas.split("\n") });
    setBusy(false);
    if (r.error) return setErr(r.error);
    onDone();
  }

  return (
    <div className="mb-2.5 rounded-3xl border-2 border-brand/30 bg-surface p-4 shadow-card">
      <div className="rounded-2xl p-4 text-white" style={{ background: TONES[d.tone as keyof typeof TONES] ?? TONES.violet }}>
        <p className="text-[18px] font-bold">{d.text || "My comfort food is…"}</p>
      </div>
      <label className="mt-4 block text-[13px] font-semibold text-muted">
        Question
        <input
          value={d.text}
          onChange={(e) => set({ text: e.target.value })}
          maxLength={80}
          placeholder="My comfort food is…"
          className="mt-1 h-12 w-full rounded-2xl border border-line bg-cream px-3.5 text-[15px] text-ink outline-none focus:border-brand"
        />
      </label>
      <label className="mt-3 block text-[13px] font-semibold text-muted">
        Tap-to-fill ideas (one per line)
        <textarea
          value={d.ideas}
          onChange={(e) => set({ ideas: e.target.value })}
          rows={4}
          placeholder={"Jollof rice\nSuya"}
          className="mt-1 w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brand"
        />
      </label>
      <p className="mt-3 text-[13px] font-semibold text-muted">Colour</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {TONE_NAMES.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={t}
            onClick={() => set({ tone: t })}
            className={clsx("h-9 w-9 rounded-full ring-offset-2 transition", d.tone === t && "ring-2 ring-ink")}
            style={{ background: TONES[t] }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        <Toggle on={d.active} onChange={(v) => set({ active: v })} label="Show this question" />
        <Toggle on={d.repeatable} onChange={(v) => set({ repeatable: v })} label="People can answer it more than once" />
      </div>
      {err && <p className="mt-3 text-[13px] font-semibold text-chili">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onDone} className="h-11 flex-1 rounded-2xl border border-line text-[14px] font-bold">
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className="h-11 flex-1 rounded-2xl bg-brand text-[14px] font-bold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-3 text-left text-[14px] font-semibold">
      <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-mint" : "bg-line-strong")}>
        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      </span>
      {label}
    </button>
  );
}
