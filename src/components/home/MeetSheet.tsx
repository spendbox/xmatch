"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, MapPin, SlidersHorizontal } from "lucide-react";
import { INTENTS, MAX_SEEK, SEEK_OPTIONS, SPICE_LEVELS, seekingLabel, seekingList, toSeeking } from "@/lib/constants";
import { Choice } from "@/components/ui/Choice";
import { Sheet } from "@/components/ui/Sheet";
import { usePrices } from "@/components/keys/usePrices";
import { Button, tapFeedback } from "@/components/ui/Button";
import { INTENT_ICONS, SEEKING_ICONS, SpiceIcon } from "@/components/ui/icons";
import { INTENT_HINTS, SPICE_HINTS, type SetupPrefs } from "./prefs";

const AGES = Array.from({ length: 82 }, (_, i) => i + 18);

/**
 * One pop-up with everything about who you'd like to meet. Changes are kept to a copy:
 * Done saves them; closing any other way (X, tapping outside, Escape) leaves them as they were.
 */
export function MeetSheet({
  open,
  onClose,
  onSave,
  prefs: saved,
  place,
  onPlace,
}: {
  open: boolean;
  /** Closed without saving */
  onClose: () => void;
  /** Done: save these */
  onSave: (prefs: SetupPrefs) => void;
  place: string | null;
  onPlace: () => void;
  prefs: SetupPrefs;
}) {
  const [prefs, setPrefs] = useState<SetupPrefs>(saved);
  // Each time it opens, start from what's saved
  useEffect(() => {
    if (open) setPrefs(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = <K extends keyof SetupPrefs>(k: K, v: SetupPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const [whoOpen, setWhoOpen] = useState(false);
  const whoSet = prefs.seeking !== "anyone";
  // Set in Admin -> Prices
  const prices = usePrices();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Who do you want to talk to?"
      subtitle="Changes apply from your next pairing."
      icon={<SlidersHorizontal size={22} strokeWidth={1.75} />}
      footer={
        <Button size="lg" onClick={() => onSave(prefs)}>
          Done
        </Button>
      }
    >
      <div className="space-y-6">
        {/* How pairing works (live pairing, update 66) */}
        <p className="flex items-start gap-2.5 rounded-2xl bg-mint-soft px-3.5 py-3 text-[13px] leading-snug text-ink-soft">
          <span className="relative mt-1 flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
          </span>
          <span>
            <b className="text-ink">Only people online are paired.</b> Keep Dashpad open and we&apos;ll pair you with someone who fits as soon as
            they&apos;re online too, {gapText(prices.pair_gap_minutes)}, 6am to 2am.
          </span>
        </p>
        <Section title="I'm in the mood for">
          <Choice
            name="I'm in the mood for"
            columns={1}
            layout="row"
            value={prefs.intent}
            onChange={(v) => set("intent", v)}
            options={INTENTS.map((i) => ({ value: i.value, label: i.label, hint: INTENT_HINTS[i.value], icon: INTENT_ICONS[i.value]({ size: 22 }) }))}
          />
        </Section>
        <Section title="Where you are" note="We pair you with people closest to you first: your state, then your country, then further.">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              onPlace();
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left hover:border-line-strong"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-ink-soft">
              <MapPin size={20} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{place ?? "Add where you are"}</span>
              <span className="block text-[12px] text-muted">{place ? "Tap to change" : "Country and state"}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </button>
        </Section>
        {/* Question spice is for icebreakers, which only dating and spicy chats get */}
        {prefs.intent !== "friends" && (
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
        )}

        {/* Gender and age: optional, Anyone by default */}
        <section className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setWhoOpen((o) => !o);
            }}
            aria-expanded={whoOpen || whoSet}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Who you meet</span>
              <span className="block text-[12px] text-muted">
                {seekingLabel(prefs.seeking)} · {prefs.ageMin}–{prefs.ageMax} · optional
              </span>
            </span>
            <ChevronDown size={18} className={clsx("shrink-0 text-muted transition", (whoOpen || whoSet) && "rotate-180")} />
          </button>
          {(whoOpen || whoSet) && (
            <div className="space-y-5 border-t border-line px-4 pt-4 pb-4">
              <Section title="I'd like to meet" note={`Pick up to ${MAX_SEEK}, or Anyone`}>
                <SeekPicker value={prefs.seeking} onChange={(v) => set("seeking", v)} />
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
            </div>
          )}
        </section>
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

/** Pick one or two genders to meet, or Anyone. Tapping a third swaps out the oldest pick. */
function SeekPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const picked = seekingList(value);
  const anyone = picked.length === 0;
  const options = [
    ...SEEK_OPTIONS.map((o) => ({ key: o.value as string, label: o.label })),
    { key: "anyone", label: "Anyone" },
  ];
  return (
    <div role="group" aria-label="I'd like to meet" className="grid grid-cols-4 gap-2">
      {options.map((o) => {
        const isAnyone = o.key === "anyone";
        const on = isAnyone ? anyone : picked.includes(o.key as never);
        const I = SEEKING_ICONS[o.key as keyof typeof SEEKING_ICONS];
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              tapFeedback();
              if (isAnyone) return onChange("anyone");
              const k = o.key as (typeof picked)[number];
              let next = on ? picked.filter((p) => p !== k) : [...picked, k];
              if (next.length > MAX_SEEK) next = next.slice(next.length - MAX_SEEK);
              onChange(toSeeking(next));
            }}
            className={clsx(
              "relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border px-1 py-3 text-center transition duration-200 active:scale-[0.97]",
              on ? "border-brand bg-brand-soft/70 shadow-[0_6px_18px_-8px_rgb(91_63_217/0.45)]" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className={clsx("grid h-10 w-10 place-items-center rounded-[13px] transition", on ? "animate-pop bg-brand text-white" : "bg-cream text-ink-soft")}>
              <I size={20} strokeWidth={1.75} />
            </span>
            <span className={clsx("text-[13px] leading-tight font-semibold", on ? "text-brand-ink" : "text-ink")}>{o.label}</span>
            {on && (
              <span className="absolute top-1.5 right-1.5 grid h-5 w-5 animate-pop place-items-center rounded-full bg-brand text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** "up to once an hour", "up to once every 30 minutes", "up to once every 2 hours" */
function gapText(min: number) {
  if (min === 60) return "up to once an hour";
  if (min % 60 === 0) return `up to once every ${min / 60} hours`;
  return `up to once every ${min} minutes`;
}
