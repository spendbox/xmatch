"use client";

import { useState } from "react";
import clsx from "clsx";
import { BellRing, CakeSlice, ChevronDown, ChevronRight, Clock3, EyeOff, HeartHandshake, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISTANCES, getLocation, INTENTS, SEEKING, SPICE_LEVELS } from "@/lib/constants";
import type { Intent, Profile, Seeking } from "@/lib/types";
import { Choice } from "@/components/ui/Choice";
import { Toggle } from "@/components/ui/Toggle";
import { Button, tapFeedback } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { DISTANCE_ICONS, INTENT_ICONS, MaskLineIcon, SEEKING_ICONS, SpiceIcon } from "@/components/ui/icons";
import { Waiting } from "./Waiting";

const AGES = Array.from({ length: 82 }, (_, i) => i + 18);

const INTENT_HINTS: Record<Intent, string> = {
  friends: "Good company, zero pressure",
  dating: "Looking for something real",
  spicy: "Flirty, fun and bold",
};
const SPICE_HINTS = [
  "Easy, getting-to-know-you questions",
  "Playful with a little flirt",
  "Flirty and personal",
  "Bold, cheeky questions",
];
const DISTANCE_HINTS: Record<number, string> = {
  10: "Your neighbourhood",
  50: "Across your city",
  200: "Nearby cities too",
  0: "Anyone, anywhere",
};

export type SetupPrefs = {
  intent: Intent;
  seeking: Seeking;
  ageMin: number;
  ageMax: number;
  spice: number;
  maxKm: number; // 0 = anywhere
};

type SheetName = "intent" | "seeking" | "age" | "distance" | "spice" | null;

export function MasqueradeSetup({
  profile,
  demoWaiting,
  demoSheet,
}: {
  profile: Profile;
  demoWaiting?: boolean;
  demoSheet?: SheetName;
}) {
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
  const [starting, setStarting] = useState<null | "location" | "matching">(null);
  const [sheet, setSheet] = useState<SheetName>(demoSheet ?? null);

  const set = <K extends keyof SetupPrefs>(k: K, v: SetupPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  async function toggleOpen(v: boolean) {
    tapFeedback();
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
    setStarting("location");
    const loc = await getLocation();
    if (!loc && prefs.maxKm > 0) {
      setStarting(null);
      return setError("Allow location so we can find people near you, or set Distance to Anywhere.");
    }
    setStarting("matching");
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
    if (err) {
      setStarting(null);
      return setError(err.message || "Couldn't start. Please try again.");
    }
    if (data) window.location.assign(`/masquerade/${data}`);
    else {
      setStarting(null);
      setWaiting(true);
    }
  }

  if (waiting) return <Waiting prefs={prefs} userId={profile.id} onCancel={() => setWaiting(false)} />;

  const intent = INTENTS.find((i) => i.value === prefs.intent)!;
  const seeking = SEEKING.find((s) => s.value === prefs.seeking)!;
  const distance = DISTANCES.find((d) => d.value === prefs.maxKm) ?? DISTANCES[1];
  const SeekIcon = SEEKING_ICONS[prefs.seeking];
  const DistIcon = DISTANCE_ICONS[distance.value];
  const close = () => setSheet(null);
  const done = (
    <Button size="lg" onClick={close}>
      Done
    </Button>
  );

  return (
    <main className="mx-auto max-w-md px-5 pt-6">
      <header>
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Masquerade</h1>
        <p className="mt-1 text-[15px] text-muted">Meet someone new on vibes alone.</p>
      </header>

      {/* Hero */}
      <section className="relative mt-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-5 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)]">
        <div aria-hidden className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10 blur-sm" />
        <div aria-hidden className="absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-gold/25 blur-xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 animate-float place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <MaskIcon className="w-11 text-white" eyes="#6d4ff0" />
          </span>
          <div>
            <p className="text-[18px] leading-snug font-semibold">Chat masked. Unmask together.</p>
            <p className="mt-0.5 text-[13px] text-white/75">If you don&apos;t both unmask, the chat disappears.</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-[12px] font-medium">
          <HeroFact icon={<Clock3 size={15} />} text="5 minutes" />
          <HeroFact icon={<EyeOff size={15} />} text="No photos" />
          <HeroFact icon={<HeartHandshake size={15} />} text="Both decide" />
        </div>
      </section>

      {/* Settings as cards */}
      <h2 className="mt-7 mb-3 text-[15px] font-semibold">Your vibe</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <SettingCard tone="brand" label="Here for" value={intent.label} icon={INTENT_ICONS[prefs.intent]({ size: 22 })} onClick={() => setSheet("intent")} />
        <SettingCard tone="pink" label="Meet" value={seeking.label} icon={<SeekIcon size={22} strokeWidth={1.75} />} onClick={() => setSheet("seeking")} />
        <SettingCard tone="gold" label="Age" value={`${prefs.ageMin} – ${prefs.ageMax}`} icon={<CakeSlice size={22} strokeWidth={1.75} />} onClick={() => setSheet("age")} />
        <SettingCard tone="mint" label="Distance" value={distance.value ? `Within ${distance.label}` : "Anywhere"} icon={<DistIcon size={22} strokeWidth={1.75} />} onClick={() => setSheet("distance")} />
        <SettingCard
          wide
          tone="chili"
          label="Question spice"
          value={SPICE_LEVELS[prefs.spice].label}
          sub="You'll see each other's pick. Questions land in the middle."
          icon={<SpiceIcon level={prefs.spice} size={22} />}
          onClick={() => setSheet("spice")}
        />
      </div>

      {/* Open to Masquerade */}
      <div className="mt-2.5 flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-4">
        <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px] transition", open ? "bg-brand text-white" : "bg-cream text-ink-soft")}>
          <BellRing size={21} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Open to Masquerade</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">Get a pop-up when someone masked is looking for you.</p>
        </div>
        <Toggle checked={open} onChange={toggleOpen} label="Open to Masquerade" />
      </div>

      <div className="space-y-3 pt-6 pb-4">
        <FormError message={error} />
        <Button
          variant="gold"
          size="lg"
          onClick={start}
          loading={!!starting}
          loadingText={starting === "location" ? "Finding your location…" : "Masking up…"}
        >
          <MaskLineIcon size={22} strokeWidth={2} />
          Put on your mask
        </Button>
        <p className="text-center text-[13px] text-muted">Be kind. You can leave or report at any time.</p>
      </div>

      {/* Pop-ups */}
      <Sheet open={sheet === "intent"} onClose={close} title="I'm here for" subtitle="You'll only meet people looking for the same thing." icon={INTENT_ICONS[prefs.intent]({ size: 24 })} footer={done}>
        <Choice
          name="I'm here for"
          columns={1}
          layout="row"
          value={prefs.intent}
          onChange={(v) => set("intent", v)}
          options={INTENTS.map((i) => ({ value: i.value, label: i.label, hint: INTENT_HINTS[i.value], icon: INTENT_ICONS[i.value]({ size: 22 }) }))}
        />
      </Sheet>

      <Sheet open={sheet === "seeking"} onClose={close} title="I'd like to meet" icon={<SeekIcon size={24} strokeWidth={1.75} />} footer={done}>
        <Choice
          name="I'd like to meet"
          value={prefs.seeking}
          onChange={(v) => set("seeking", v)}
          options={SEEKING.map((s) => {
            const I = SEEKING_ICONS[s.value];
            return { value: s.value, label: s.label, icon: <I size={22} strokeWidth={1.75} /> };
          })}
        />
      </Sheet>

      <Sheet open={sheet === "age"} onClose={close} title="Age range" subtitle="Everyone on Dashpad is 18+." icon={<CakeSlice size={24} strokeWidth={1.75} />} footer={done}>
        <div className="grid grid-cols-2 gap-2.5">
          <AgeSelect label="From" value={prefs.ageMin} onChange={(v) => setPrefs((p) => ({ ...p, ageMin: v, ageMax: Math.max(v, p.ageMax) }))} />
          <AgeSelect label="To" value={prefs.ageMax} onChange={(v) => setPrefs((p) => ({ ...p, ageMax: v, ageMin: Math.min(v, p.ageMin) }))} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            [18, 24],
            [21, 30],
            [25, 35],
            [30, 45],
            [40, 60],
          ].map(([a, b]) => {
            const on = prefs.ageMin === a && prefs.ageMax === b;
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  tapFeedback();
                  setPrefs((p) => ({ ...p, ageMin: a, ageMax: b }));
                }}
                className={clsx(
                  "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-95",
                  on ? "border-brand bg-brand text-white" : "border-line-strong text-ink-soft",
                )}
              >
                {a}–{b}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={sheet === "distance"} onClose={close} title="Distance" subtitle="Closest people are matched first. Your exact location is never shown." icon={<MapPin size={24} strokeWidth={1.75} />} footer={done}>
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
      </Sheet>

      <Sheet open={sheet === "spice"} onClose={close} title="Question spice" subtitle="They'll see your pick and you'll see theirs. The questions land in the middle." icon={<SpiceIcon level={prefs.spice} size={24} />} footer={done}>
        <Choice
          name="Question spice"
          columns={1}
          layout="row"
          value={prefs.spice}
          onChange={(v) => set("spice", v)}
          options={SPICE_LEVELS.map((s) => ({ value: s.value, label: s.label, hint: SPICE_HINTS[s.value], icon: <SpiceIcon level={s.value} size={22} /> }))}
        />
      </Sheet>
    </main>
  );
}

function HeroFact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5 rounded-xl bg-white/12 px-2 py-2 backdrop-blur">
      {icon}
      {text}
    </span>
  );
}

const TONES = {
  brand: "bg-brand-soft text-brand",
  pink: "bg-[#fde8f1] text-[#c2306b]",
  gold: "bg-gold-soft text-[#a26b00]",
  mint: "bg-mint-soft text-mint",
  chili: "bg-chili-soft text-chili",
};

function SettingCard({
  label,
  value,
  sub,
  icon,
  tone,
  wide,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      className={clsx(
        "group flex rounded-3xl border border-line bg-surface p-4 text-left shadow-card transition duration-200 hover:border-line-strong active:scale-[0.97]",
        wide ? "col-span-2 items-center gap-3.5" : "flex-col gap-3",
      )}
    >
      {wide ? (
        <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", TONES[tone])}>{icon}</span>
      ) : (
        <span className="flex w-full items-start justify-between">
          <span className={clsx("grid h-11 w-11 place-items-center rounded-[14px]", TONES[tone])}>{icon}</span>
          <ChevronRight size={18} className="mt-1 text-muted transition group-hover:translate-x-0.5" />
        </span>
      )}
      <span className={clsx("min-w-0", wide && "flex-1")}>
        <span className="block text-[12px] font-medium text-muted">{label}</span>
        <span className="mt-0.5 block truncate text-[16px] font-semibold text-ink">{value}</span>
        {sub && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{sub}</span>}
      </span>
      {wide && <ChevronRight size={18} className="shrink-0 text-muted" />}
    </button>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="relative flex h-16 items-center justify-between rounded-2xl border border-line bg-cream px-4 focus-within:border-brand">
      <span className="text-[14px] font-medium text-muted">{label}</span>
      <span className="flex items-center gap-1 text-[20px] font-semibold">
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
