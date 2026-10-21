"use client";

import { plural, word } from "@/lib/plural";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Ban, Check, Eye, Trash2 } from "lucide-react";
import { cancelNight, deleteNight, saveNight, type NightInput } from "@/app/admin/(panel)/actions";
import { EVENT_THEMES, eventPhase, eventWhen, themeBg } from "@/lib/events";
import { INTENTS, intentLabel } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Label, Textarea } from "@/components/ui/Field";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import type { AdminNight } from "./NightsList";

const DURATIONS = [30, 45, 60, 90, 120, 180];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NightEditor({ night, questions = [] }: { night?: AdminNight; questions?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState(() => ({
    title: night?.title ?? "",
    description: night?.description ?? "",
    theme: night?.theme ?? "violet",
    intent: night?.intent ?? "dating",
    startsLocal: "",
    duration: night ? Math.round((new Date(night.ends_at).getTime() - new Date(night.starts_at).getTime()) / 60000) : 60,
    ageMin: night?.age_min ?? 21,
    ageMax: night?.age_max ?? 35,
    entryKeys: night?.entry_keys ?? 0,
    maxAttendees: night?.max_attendees ?? 0,
    questions: questions.join("\n"),
  }));
  // Local time only exists in the browser
  useEffect(() => {
    const base = night?.starts_at ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); // next Friday
      d.setHours(21, 0, 0, 0);
      return d.toISOString();
    })();
    setF((x) => ({ ...x, startsLocal: toLocalInput(base) }));
  }, [night?.starts_at]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };

  function save(status: "draft" | "published") {
    setError(null);
    const startIso = f.startsLocal ? new Date(f.startsLocal).toISOString() : "";
    const input: NightInput = {
      id: night?.id,
      title: f.title,
      description: f.description,
      theme: f.theme,
      intent: f.intent,
      starts_at: startIso,
      duration_min: Number(f.duration),
      age_min: Number(f.ageMin),
      age_max: Number(f.ageMax),
      entry_keys: Number(f.entryKeys),
      max_attendees: Number(f.maxAttendees) || null,
      status,
      questions: f.questions,
    };
    start(async () => {
      const res = await saveNight(input);
      if (res.error) return setError(res.error);
      setSaved(true);
      if (!night && res.id) router.replace(`/admin/nights/${res.id}`);
      else router.refresh();
    });
  }

  function cancel() {
    if (!night || !confirm(`Cancel "${night.title}"? Everyone going gets their Keys back.`)) return;
    start(async () => {
      const res = await cancelNight(night.id);
      if ("error" in res && res.error) return setError(res.error);
      router.refresh();
    });
  }
  function remove() {
    if (!night || !confirm(`Delete "${night.title}" for good?`)) return;
    start(async () => {
      const res = await deleteNight(night.id);
      if ("error" in res && res.error) return setError(res.error);
      router.replace("/admin/nights");
    });
  }

  const phase = night ? (night.status === "draft" ? "draft" : eventPhase(night)) : "new";
  const qCount = f.questions.split("\n").filter((l) => l.trim().length >= 5).length;
  const preview = { starts: f.startsLocal ? new Date(f.startsLocal).toISOString() : null };

  return (
    <>
      <Link href="/admin/nights" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> All events
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-tight font-semibold">{night ? "Edit night" : "New Masquerade Night"}</h1>
          {night && (
            <p className="mt-1 text-[14px] text-muted">
              Status: <span className="font-semibold text-ink capitalize">{phase}</span> · {night.going_count} going · {plural(night.rounds, "round")} · {plural(night.unmasks, "unmask")}
            </p>
          )}
        </div>
        {night && night.status !== "cancelled" && (
          <div className="flex gap-2">
            {night.going_count > 0 ? (
              <Button variant="danger" onClick={cancel} disabled={pending}>
                <Ban size={16} /> Cancel & refund
              </Button>
            ) : (
              <Button variant="danger" onClick={remove} disabled={pending}>
                <Trash2 size={16} /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-card lg:col-span-7 lg:p-7">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={f.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Afrobeats Lovers" />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} maxLength={600} value={f.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Who it's for and what makes it fun. e.g. Everyone here loves Afrobeats. Bring your best song recommendations." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="start">Starts (your local time)</Label>
              <Input id="start" type="datetime-local" value={f.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dur">Length</Label>
              <select id="dur" value={f.duration} onChange={(e) => set("duration", Number(e.target.value))}
                className="h-13 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[16px] outline-none focus:border-brand">
                {[...new Set([...DURATIONS, f.duration])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>{d < 60 ? `${d} minutes` : `${d / 60} hour${d === 60 ? "" : "s"}`} · about {Math.floor(d / 5.5)} rounds</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Here for</Label>
            <div className="grid grid-cols-3 gap-2">
              {INTENTS.map((i) => (
                <button key={i.value} type="button" onClick={() => set("intent", i.value)}
                  className={clsx("flex h-12 items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold",
                    f.intent === i.value ? "border-brand bg-brand-soft text-brand-ink" : "border-line")}>
                  {INTENT_ICONS[i.value]({ size: 17 })} {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField label="Min age" value={f.ageMin} min={18} max={99} onChange={(v) => set("ageMin", v)} />
            <NumberField label="Max age" value={f.ageMax} min={18} max={99} onChange={(v) => set("ageMax", v)} />
            <NumberField label="Entry (Keys)" value={f.entryKeys} min={0} max={500} onChange={(v) => set("entryKeys", v)} hint="0 = free" />
            <NumberField label="Max people" value={f.maxAttendees} min={0} max={100000} onChange={(v) => set("maxAttendees", v)} hint="0 = no limit" />
          </div>

          <div>
            <Label>Card colour</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_THEMES.map((t) => (
                <button key={t.value} type="button" onClick={() => set("theme", t.value)}
                  className={clsx("flex h-10 items-center gap-2 rounded-full border pr-4 pl-1.5 text-[13px] font-semibold",
                    f.theme === t.value ? "border-brand ring-2 ring-brand/30" : "border-line")}>
                  <span className={clsx("h-7 w-7 rounded-full bg-gradient-to-br", t.bg)} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="qs">
              The night&apos;s icebreakers <span className="font-normal text-muted">· {qCount} · one per line</span>
            </Label>
            <Textarea id="qs" rows={7} value={f.questions} onChange={(e) => set("questions", e.target.value)}
              placeholder={"Which Afrobeats song never leaves your playlist?\nBest concert you've ever been to?\nWho's your dream duet partner?"} />
            <p className="mt-1.5 text-[12px] text-muted">These are asked first during the night. When they run out, regular questions are used.</p>
          </div>

          <FormError message={error} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="lg" className="sm:w-auto sm:flex-1" onClick={() => save("published")} loading={pending} loadingText="Saving…">
              {saved ? <><Check size={18} /> Saved</> : night?.status === "published" ? "Save changes" : "Publish night"}
            </Button>
            {night?.status !== "published" && (
              <Button size="lg" variant="secondary" className="sm:w-auto sm:flex-1" onClick={() => save("draft")} disabled={pending}>
                Save as draft
              </Button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-5">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted"><Eye size={15} /> How members see it</p>
          <div className="overflow-hidden rounded-[28px] bg-surface shadow-lift lg:sticky lg:top-8">
            <div className={clsx("relative bg-gradient-to-br p-6 text-white", themeBg(f.theme))}>
              <span aria-hidden className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">
                Masquerade Night
              </span>
              <MaskIcon className="absolute top-5 right-5 w-12 animate-float text-white/90" eyes="transparent" />
              <p className="relative mt-4 font-display text-[26px] leading-tight font-semibold">{f.title || "Your night's title"}</p>
              <p className="relative mt-1 text-[14px] text-white/80">{preview.starts ? eventWhen(preview.starts, new Date(new Date(preview.starts).getTime() + f.duration * 60000).toISOString()) : "Pick a time"}</p>
            </div>
            <div className="space-y-3 p-5">
              {f.description && <p className="text-[14px] leading-relaxed text-ink-soft">{f.description}</p>}
              <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1">{INTENT_ICONS[f.intent as "dating"]({ size: 13 })} {intentLabel(f.intent as "dating")}</span>
                <span className="rounded-full bg-cream px-2.5 py-1">Ages {f.ageMin}–{f.ageMax}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[#8a5a00]">
                  {f.entryKeys > 0 ? <><KeyCoin size={13} /> {plural(f.entryKeys, "Key")}</> : "Free"}
                </span>
              </div>
              <div className="h-12 rounded-2xl bg-brand text-center text-[15px] leading-[48px] font-semibold text-white">I&apos;m going</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function NumberField({ label, value, onChange, min, max, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; hint?: string }) {
  // Kept as text so typing replaces the 0 instead of giving "021"
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text || 0) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 6);
          setText(digits);
          onChange(digits === "" ? 0 : Number(digits));
        }}
        onBlur={() => {
          const n = Math.min(max, Math.max(min, Number(text || 0)));
          setText(String(n));
          onChange(n);
        }}
      />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
