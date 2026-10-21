"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISTANCES, getLocation, INTENTS, SEEKING, SPICE_LEVELS } from "@/lib/constants";
import type { Intent, Profile, Seeking } from "@/lib/types";
import { Choice } from "@/components/ui/Choice";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { Chilis } from "@/components/ui/Spice";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Waiting } from "./Waiting";

const INTENT_ICONS: Record<Intent, string> = { friends: "🤝", dating: "💜", spicy: "🔥" };
const AGES = Array.from({ length: 82 }, (_, i) => i + 18);

export type SetupPrefs = {
  intent: Intent;
  seeking: Seeking;
  ageMin: number;
  ageMax: number;
  spice: number;
  maxKm: number; // 0 = anywhere
};

export function MasqueradeSetup({ profile, demoWaiting }: { profile: Profile; demoWaiting?: boolean }) {
  const [prefs, setPrefs] = useState<SetupPrefs>({
    intent: profile.pref_intent,
    seeking: profile.pref_seeking,
    ageMin: profile.pref_age_min,
    ageMax: profile.pref_age_max,
    spice: profile.pref_spice,
    maxKm: profile.pref_max_km ?? 50,
  });
  const [open, setOpen] = useState(profile.open_to_masquerade);
  const [waiting, setWaiting] = useState(!!demoWaiting);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const set = <K extends keyof SetupPrefs>(k: K, v: SetupPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  async function toggleOpen(v: boolean) {
    setOpen(v);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({
        open_to_masquerade: v,
        pref_intent: prefs.intent,
        pref_seeking: prefs.seeking,
        pref_age_min: prefs.ageMin,
        pref_age_max: prefs.ageMax,
        pref_spice: prefs.spice,
        pref_max_km: prefs.maxKm || null,
      })
      .eq("id", profile.id);
    if (err) setOpen(!v);
  }

  async function start() {
    setError(null);
    setStarting(true);
    const loc = await getLocation();
    if (!loc && prefs.maxKm > 0) {
      setStarting(false);
      return setError("Allow location so we can find people near you, or choose Anywhere.");
    }
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("start_masquerade", {
      p_intent: prefs.intent,
      p_seeking: prefs.seeking,
      p_age_min: prefs.ageMin,
      p_age_max: prefs.ageMax,
      p_spice: prefs.spice,
      p_max_km: prefs.maxKm || null,
      p_lat: loc?.lat ?? null,
      p_lng: loc?.lng ?? null,
    });
    setStarting(false);
    if (err) return setError(err.message || "Couldn't start. Please try again.");
    if (data) window.location.assign(`/masquerade/${data}`);
    else setWaiting(true);
  }

  if (waiting) return <Waiting prefs={prefs} userId={profile.id} onCancel={() => setWaiting(false)} />;

  return (
    <main className="mx-auto max-w-md px-5 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Masquerade</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
            Five minutes with someone new, both masked. Unmask only if you both say yes.
          </p>
        </div>
        <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <MaskIcon className="w-8" eyes="#efebfd" />
        </span>
      </header>

      <div className="mt-7 space-y-7">
        <Section title="I'm here for">
          <Choice
            name="I'm here for"
            value={prefs.intent}
            onChange={(v) => set("intent", v)}
            options={INTENTS.map((i) => ({ value: i.value, label: i.label, icon: INTENT_ICONS[i.value] }))}
          />
        </Section>

        <Section title="I'd like to meet">
          <Choice name="I'd like to meet" value={prefs.seeking} onChange={(v) => set("seeking", v)} options={SEEKING} />
        </Section>

        <Section title="Aged">
          <div className="grid grid-cols-2 gap-2">
            <AgeSelect
              label="From"
              value={prefs.ageMin}
              onChange={(v) => setPrefs((p) => ({ ...p, ageMin: v, ageMax: Math.max(v, p.ageMax) }))}
            />
            <AgeSelect
              label="To"
              value={prefs.ageMax}
              onChange={(v) => setPrefs((p) => ({ ...p, ageMax: v, ageMin: Math.min(v, p.ageMin) }))}
            />
          </div>
        </Section>

        <Section title="Distance" note="Closest people are matched first. Your exact location is never shown.">
          <Choice
            name="Distance"
            columns={4}
            size="sm"
            value={prefs.maxKm}
            onChange={(v) => set("maxKm", v)}
            options={DISTANCES.map((d) => ({ value: d.value, label: d.label, icon: d.value ? <MapPin size={16} /> : "🌍" }))}
          />
        </Section>

        <Section
          title="Icebreaker spice"
          note="You'll see each other's pick. The questions land in the middle of your two choices."
        >
          <Choice
            name="Icebreaker spice"
            columns={2}
            value={prefs.spice}
            onChange={(v) => set("spice", v)}
            options={SPICE_LEVELS.map((s) => ({
              value: s.value,
              label: s.label,
              icon: <Chilis level={s.value} />,
            }))}
          />
        </Section>

        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
          <div className="flex-1">
            <p className="font-semibold">Open to Masquerade</p>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              Get a pop-up when someone masked is looking for someone like you.
            </p>
          </div>
          <Toggle checked={open} onChange={toggleOpen} label="Open to Masquerade" />
        </div>

        <div className="space-y-3 pb-4">
          <FormError message={error} />
          <Button variant="gold" size="lg" onClick={start} loading={starting}>
            <MaskIcon className="w-6" eyes="#f2b33d" />
            Put on your mask
          </Button>
          <p className="text-center text-[13px] text-muted">Be kind. You can leave or report at any time.</p>
        </div>
      </div>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold text-ink">{title}</h2>
      {children}
      {note && <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="relative flex h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4">
      <span className="text-[14px] font-medium text-muted">{label}</span>
      <span className="flex items-center gap-1 text-[17px] font-semibold">
        {value}
        <ChevronDown size={18} className="text-muted" />
      </span>
      <select
        aria-label={`Age ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {AGES.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
