"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { BONUS_NEEDED, NEEDED, PROMPTS, TONES, type ThingPromptRow } from "@/lib/things";
import { THING_ICONS, ThingIcon } from "@/components/profile/ThingIcon";
import { moveThingPrompt, saveThingPrompt } from "@/app/admin/(panel)/things/actions";
import { AdminTitle } from "./AdminShell";

const TONE_NAMES = Object.keys(TONES) as (keyof typeof TONES)[];
type Draft = { id?: string; text: string; ideas: string; tone: string; repeatable: boolean; active: boolean; icon: string };
const iconOf = (r: { id: string; icon?: string | null }) => r.icon || PROMPTS.find((p) => p.id === r.id)?.icon || "message-circle";

/** Admin: the "Things about you" cards people answer to set up their profile */
export function ThingsManager({ rows, counts, missing }: { rows: ThingPromptRow[]; counts: Record<string, number>; missing?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const live = rows.filter((r) => r.active);
  const short = live.filter((r) => !r.repeatable).length < NEEDED;
  // Where each shown card falls: the first 10 finish a profile, the next 10 are the bonus round
  const rank = new Map(live.filter((r) => !r.repeatable).map((r, k) => [r.id, k]));

  async function move(id: string, dir: -1 | 1) {
    const r = await moveThingPrompt(id, dir);
    if (r.error) setNote(r.error);
    start(() => router.refresh());
  }

  return (
    <>
      <AdminTitle
        title="Profile questions"
        subtitle={`The "Things about you" cards. People answer the first ${NEEDED} to finish their profile, then ${BONUS_NEEDED - NEEDED} more in the bonus round for extra Keys (set in Prices). Changes apply right away.`}
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
              draft={{ text: "", ideas: "", tone: "violet", repeatable: false, active: true, icon: "message-circle" }}
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
                    draft={{ id: r.id, text: r.text, ideas: (r.ideas ?? []).join("\n"), tone: r.tone, repeatable: r.repeatable, active: r.active, icon: iconOf(r) }}
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
                    className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
                    style={{ background: TONES[r.tone as keyof typeof TONES] ?? TONES.violet }}
                  >
                    <ThingIcon name={iconOf(r)} size={22} />
                    <span className="absolute -top-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10.5px] font-extrabold text-white">{i + 1}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[15px] font-bold">
                      {r.text}
                      {rank.has(r.id) && (
                        <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase", rank.get(r.id)! < NEEDED ? "bg-brand-soft text-brand" : rank.get(r.id)! < BONUS_NEEDED ? "bg-gold-soft text-[#8a5a00]" : "bg-cream text-muted")}>
                          {rank.get(r.id)! < NEEDED ? "Profile" : rank.get(r.id)! < BONUS_NEEDED ? "Bonus" : "Extra"}
                        </span>
                      )}
                    </p>
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
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
          <ThingIcon name={d.icon} size={20} />
        </span>
        <p className="mt-2 text-[18px] font-bold">{d.text || "My comfort food is…"}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {d.ideas
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 12)
            .map((x) => (
              <span key={x} className="rounded-xl bg-white/15 px-2.5 py-1.5 text-[12.5px] font-semibold">{x}</span>
            ))}
        </div>
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
        Answers people tap (one per line, up to 12)
        <textarea
          value={d.ideas}
          onChange={(e) => set({ ideas: e.target.value })}
          rows={4}
          placeholder={"Jollof rice\nSuya"}
          className="mt-1 w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brand"
        />
      </label>
      <p className="mt-3 text-[13px] font-semibold text-muted">Icon</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.keys(THING_ICONS).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k}
            title={k}
            onClick={() => set({ icon: k })}
            className={clsx("grid h-10 w-10 place-items-center rounded-xl border transition", d.icon === k ? "border-brand bg-brand-soft text-brand" : "border-line bg-cream text-ink-soft")}
          >
            <ThingIcon name={k} size={18} />
          </button>
        ))}
      </div>
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
