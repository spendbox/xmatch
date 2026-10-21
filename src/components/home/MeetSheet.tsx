"use client";

import clsx from "clsx";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { DISTANCES, INTENTS, SEEKING, SPICE_LEVELS } from "@/lib/constants";
import { Choice } from "@/components/ui/Choice";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { DISTANCE_ICONS, INTENT_ICONS, SEEKING_ICONS, SpiceIcon } from "@/components/ui/icons";
import { DISTANCE_HINTS, INTENT_HINTS, SPICE_HINTS, type SetupPrefs } from "./prefs";

const AGES = Array.from({ length: 82 }, (_, i) => i + 18);

/** One pop-up with everything about who you'd like to meet. */
export function MeetSheet({
  open,
  onClose,
  prefs,
  setPrefs,
}: {
  open: boolean;
  onClose: () => void;
  prefs: SetupPrefs;
  setPrefs: (fn: (p: SetupPrefs) => SetupPrefs) => void;
}) {
  const set = <K extends keyof SetupPrefs>(k: K, v: SetupPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Who you'd like to meet"
      subtitle="We'll only pair you with people who fit, both ways."
      icon={<SlidersHorizontal size={22} strokeWidth={1.75} />}
      footer={
        <Button size="lg" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-6">
        <Section title="I'm here for">
          <Choice
            name="I'm here for"
            columns={1}
            layout="row"
            value={prefs.intent}
            onChange={(v) => set("intent", v)}
            options={INTENTS.map((i) => ({ value: i.value, label: i.label, hint: INTENT_HINTS[i.value], icon: INTENT_ICONS[i.value]({ size: 22 }) }))}
          />
        </Section>
        <Section title="I'd like to meet">
          <Choice
            name="I'd like to meet"
            value={prefs.seeking}
            onChange={(v) => set("seeking", v)}
            options={SEEKING.map((s) => {
              const I = SEEKING_ICONS[s.value];
              return { value: s.value, label: s.label, icon: <I size={22} strokeWidth={1.75} /> };
            })}
          />
        </Section>
        <Section title="Aged">
          <div className="grid grid-cols-2 gap-2.5">
            <AgeSelect label="From" value={prefs.ageMin} onChange={(v) => setPrefs((p) => ({ ...p, ageMin: v, ageMax: Math.max(v, p.ageMax) }))} />
            <AgeSelect label="To" value={prefs.ageMax} onChange={(v) => setPrefs((p) => ({ ...p, ageMax: v, ageMin: Math.min(v, p.ageMin) }))} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[[18, 24], [21, 30], [25, 35], [30, 45], [40, 60]].map(([a, b]) => {
              const on = prefs.ageMin === a && prefs.ageMax === b;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setPrefs((p) => ({ ...p, ageMin: a, ageMax: b }));
                  }}
                  className={clsx("h-9 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-95", on ? "border-brand bg-brand text-white" : "border-line-strong text-ink-soft")}
                >
                  {a}–{b}
                </button>
              );
            })}
          </div>
        </Section>
        <Section title="Distance" note="Closest people are matched first. Your exact location is never shown.">
          <Choice
            name="Distance"
            columns={2}
            value={prefs.maxKm}
            onChange={(v) => set("maxKm", v)}
            options={DISTANCES.map((d) => {
              const I = DISTANCE_ICONS[d.value];
              return { value: d.value, label: d.value ? `Within ${d.label}` : "Anywhere", hint: DISTANCE_HINTS[d.value], icon: <I size={22} strokeWidth={1.75} /> };
            })}
          />
        </Section>
        <Section title="Question spice" note="You'll see each other's pick. The questions land in the middle.">
          <Choice
            name="Question spice"
            columns={1}
            layout="row"
            value={prefs.spice}
            onChange={(v) => set("spice", v)}
            options={SPICE_LEVELS.map((s) => ({ value: s.value, label: s.label, hint: SPICE_HINTS[s.value], icon: <SpiceIcon level={s.value} size={22} /> }))}
          />
        </Section>
      </div>
    </Sheet>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[14px] font-semibold text-ink">{title}</h3>
      {children}
      {note && <p className="mt-2 text-[12px] leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="relative flex h-14 items-center justify-between rounded-2xl border border-line bg-cream px-4 focus-within:border-brand">
      <span className="text-[14px] font-medium text-muted">{label}</span>
      <span className="flex items-center gap-1 text-[18px] font-semibold">
        {value}
        <ChevronDown size={18} className="text-muted" />
      </span>
      <select aria-label={`Age ${label.toLowerCase()}`} value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-0 cursor-pointer opacity-0">
        {AGES.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
