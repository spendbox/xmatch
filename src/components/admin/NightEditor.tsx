"use client";

import { plural } from "@/lib/plural";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft, Ban, Bell, CalendarClock, Check, Eye, ImagePlus, MessageCircleQuestion, MessagesSquare, Music, Radio, Shuffle, Trash2, Type, Users,
} from "lucide-react";
import {
  cancelNight, deleteNight, discardEventUpload, saveNight, type AdminMedia, type AdminRoomMessage, type NightInput,
} from "@/app/admin/(panel)/actions";
import { EVENT_KINDS, EVENT_THEMES, SETTING_DEFAULTS, eventPhase, eventWhen, isChooseKind, kindLabel, themeBg, type EventKind, type EventSettings } from "@/lib/events";
import { INTENTS, intentLabel } from "@/lib/constants";
import { Button, Spinner } from "@/components/ui/Button";
import { FormError, Input, Label, Textarea } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { KindIcon, type AdminNight } from "./NightsList";
import { EventMediaList } from "./EventMediaList";
import { EmailAttendeesCard, LiveRoomCard } from "./EventLiveTools";
import { uploadEventFile } from "./eventUpload";

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1080, 1440];
const SLOW_MODES = [0, 5, 10, 30, 60];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const lengthLabel = (d: number) => (d < 60 ? `${d} minutes` : d % 60 ? `${Math.floor(d / 60)}h ${d % 60}m` : `${d / 60} hour${d === 60 ? "" : "s"}`);

export function NightEditor({
  night,
  defaults,
  questions = [],
  media = [],
  room = [],
}: {
  night?: AdminNight;
  /** Prices from Admin → Prices, used for new events */
  defaults?: Partial<EventSettings>;
  questions?: string[];
  media?: AdminMedia[];
  room?: AdminRoomMessage[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [f, setF] = useState(() => ({
    kind: (night?.kind ?? "masquerade") as EventKind,
    title: night?.title ?? "",
    description: night?.description ?? "",
    theme: night?.theme ?? "violet",
    intent: night?.intent ?? "dating",
    coverUrl: night?.cover_url ?? "",
    streamUrl: night?.stream_url ?? "",
    startsLocal: "",
    duration: night ? Math.round((new Date(night.ends_at).getTime() - new Date(night.starts_at).getTime()) / 60000) : 60,
    ageMin: night?.age_min ?? 21,
    ageMax: night?.age_max ?? 35,
    entryKeys: night?.entry_keys ?? 0,
    maxAttendees: night?.max_attendees ?? 0,
    questions: questions.join("\n"),
  }));
  const [s, setS] = useState<Required<EventSettings>>(() => ({ ...SETTING_DEFAULTS, ...(night ? {} : defaults ?? {}), ...(night?.settings ?? {}) }));

  // Local time only exists in the browser
  useEffect(() => {
    setNow(Date.now());
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
  const setting = <K extends keyof EventSettings>(k: K, v: Required<EventSettings>[K]) => {
    setSaved(false);
    setS((x) => ({ ...x, [k]: v }));
  };

  function save(status: "draft" | "published") {
    setError(null);
    const startIso = f.startsLocal ? new Date(f.startsLocal).toISOString() : "";
    const input: NightInput = {
      id: night?.id,
      kind: f.kind,
      title: f.title,
      description: f.description,
      theme: f.theme,
      intent: f.intent,
      cover_url: f.coverUrl || null,
      stream_url: f.streamUrl.trim() || null,
      settings: s,
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

  const phase = night ? (night.status === "draft" ? "draft" : now === null ? "" : eventPhase(night, now)) : "new";
  const choose = isChooseKind(f.kind);
  const qCount = f.questions.split("\n").filter((l) => l.trim().length >= 5).length;
  const startsIso = f.startsLocal ? new Date(f.startsLocal).toISOString() : null;
  const streamBad = !!f.streamUrl.trim() && !/^https?:\/\/\S+$/i.test(f.streamUrl.trim());

  return (
    <>
      <Link href="/admin/nights" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> All events
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-tight font-semibold">{night ? "Edit event" : "New event"}</h1>
          {night && (
            <p className="mt-1 text-[14px] text-muted">
              {kindLabel(night.kind)} · <span className="font-semibold text-ink capitalize">{phase}</span> · {night.going_count} going
              {(night.kind ?? "masquerade") === "masquerade" && <> · {plural(night.rounds, "round")} · {plural(night.unmasks, "unmask")}</>}
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

      {/* Live tools for an existing event */}
      {night && night.status !== "cancelled" && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {phase === "live" && isChooseKind(night.kind) && <LiveRoomCard eventId={night.id} initial={room} />}
          <EmailAttendeesCard eventId={night.id} going={night.going_count} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          {/* Kind */}
          <Section icon={<Shuffle size={17} />} title="What kind of event?">
            <div role="radiogroup" aria-label="Kind of event" className="grid gap-2.5 sm:grid-cols-3">
              {EVENT_KINDS.map((k) => {
                const on = f.kind === k.value;
                return (
                  <button key={k.value} type="button" role="radio" aria-checked={on} onClick={() => set("kind", k.value)}
                    className={clsx("relative flex items-start gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.98] sm:flex-col sm:gap-2.5",
                      on ? "border-brand bg-brand-soft/70 shadow-[0_6px_18px_-8px_rgb(91_63_217/0.45)]" : "border-line bg-surface hover:border-line-strong")}>
                    <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px] transition", on ? "bg-brand text-white" : "bg-cream text-ink-soft")}>
                      <KindIcon kind={k.value} size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className={clsx("block text-[15px] leading-tight font-semibold", on ? "text-brand-ink" : "text-ink")}>{k.label}</span>
                      <span className="mt-1 block text-[12px] leading-snug text-muted">{k.hint}</span>
                    </span>
                    {on && (
                      <span className="absolute top-2.5 right-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Basics */}
          <Section icon={<Type size={17} />} title="Basics">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={f.title} maxLength={80} onChange={(e) => set("title", e.target.value)}
                placeholder={f.kind === "party" ? "e.g. Afrobeats Listening Party" : "e.g. Afrobeats Lovers"} />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={3} maxLength={600} value={f.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Who it's for and what makes it fun. e.g. Everyone here loves Afrobeats. Bring your best song recommendations." />
            </div>
            <CoverPicker eventId={night?.id ?? null} url={f.coverUrl} savedUrl={night?.cover_url ?? null} onChange={(u) => set("coverUrl", u)} />
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
          </Section>

          {/* When & who */}
          <Section icon={<CalendarClock size={17} />} title="When & who">
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
                    <option key={d} value={d}>{lengthLabel(d)}{f.kind === "masquerade" ? ` · about ${Math.floor(d / 5.5)} rounds` : ""}</option>
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
          </Section>

          {/* Meeting people */}
          <Section icon={<Users size={17} />} title="Meeting people">
            {choose ? (
              <>
                <p className="text-[13px] text-muted">Guests browse a wall of blurred photos, reveal the ones they like and start private chats. Chats last until the event ends, then both decide to keep or let go.</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <NumberField label="Chats each" value={s.max_chats} min={1} max={100} onChange={(v) => setting("max_chats", v)} hint="How many chats a person can start" />
                  <NumberField label="Free reveals" value={s.free_reveals} min={0} max={1000} onChange={(v) => setting("free_reveals", v)} hint="Photos each person can reveal free" />
                  <NumberField label="Keys per reveal" value={s.reveal_cost} min={0} max={100} onChange={(v) => setting("reveal_cost", v)} hint="After the free ones (0 = free)" />
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-cream/70 p-4 text-[14px] text-ink-soft">
                <MaskIcon className="mt-0.5 w-6 shrink-0 text-brand" eyes="#faf7f2" />
                <p>Pairing is automatic. Everyone gets masked 5-minute rounds with a new person each round, and can unmask if they both like it.</p>
              </div>
            )}
          </Section>

          {/* Room */}
          <Section icon={<MessagesSquare size={17} />} title="The room">
            <ToggleRow label="Room chat" hint="Everyone at the event can chat together" checked={s.room_chat} onChange={(v) => setting("room_chat", v)} />
            {s.room_chat && (
              <div>
                <Label>Slow mode</Label>
                <div className="grid grid-cols-5 gap-1.5 rounded-2xl bg-cream p-1">
                  {SLOW_MODES.map((n) => (
                    <button key={n} type="button" onClick={() => setting("slow_mode", n)}
                      className={clsx("h-10 rounded-xl text-[14px] font-semibold transition", s.slow_mode === n ? "bg-surface text-brand shadow-card" : "text-muted hover:text-ink")}>
                      {n ? `${n}s` : "Off"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] text-muted">How long each person waits between messages. Helps when the room gets busy.</p>
              </div>
            )}
            <ToggleRow label="Hype reactions" hint="Floating emoji reactions like 🔥 😍 👏" checked={s.hype} onChange={(v) => setting("hype", v)} />
          </Section>

          {/* Music & video */}
          <Section icon={<Music size={17} />} title="Music & video"
            hint={f.kind === "party" ? "The main show. Plays for everyone in order from the start time." : "Optional background music or video for the room."}>
            <EventMediaList eventId={night?.id ?? null} initial={media} />
            <div>
              <Label htmlFor="stream"><span className="inline-flex items-center gap-1.5"><Radio size={15} /> Live stream or video link</span></Label>
              <Input id="stream" type="url" inputMode="url" value={f.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              <p className={clsx("mt-1.5 text-[12px]", streamBad ? "font-semibold text-chili" : "text-muted")}>
                {streamBad ? "Links must start with https://" : "YouTube links, .m3u8 live streams and direct .mp3 / .mp4 links all work."}
              </p>
            </div>
            <ToggleRow label="Show the video" hint="Off plays only the sound of YouTube links and videos (good for music videos)" checked={s.show_video} onChange={(v) => setting("show_video", v)} />
            <ToggleRow label="Keep playing under private chats" hint="Music keeps going quietly while people chat one-to-one" checked={s.media_under_chats} onChange={(v) => setting("media_under_chats", v)} />
            <p className="rounded-xl bg-gold-soft px-3.5 py-2.5 text-[12px] text-[#8a5a00]">Only upload music and videos you have the rights to play.</p>
            <p className="rounded-xl bg-cream px-3.5 py-2.5 text-[12px] text-ink-soft">
              Data use: every guest downloads uploaded files from your Supabase storage, which counts toward its monthly download allowance
              (for example, 200 guests × a 40 MB playlist ≈ 8 GB). For big events, a live stream or YouTube link costs you nothing.
            </p>
          </Section>

          {/* Icebreakers (masquerade only) */}
          {f.kind === "masquerade" && (
            <Section icon={<MessageCircleQuestion size={17} />} title="The event's icebreakers" hint={`${qCount} · one per line`}>
              <Textarea id="qs" rows={7} value={f.questions} onChange={(e) => set("questions", e.target.value)}
                placeholder={"Which Afrobeats song never leaves your playlist?\nBest concert you've ever been to?\nWho's your dream duet partner?"} />
              <p className="-mt-2 text-[12px] text-muted">These are asked first during the event. When they run out, regular questions are used.</p>
            </Section>
          )}

          {/* Notifications */}
          <Section icon={<Bell size={17} />} title="Notifications">
            <ToggleRow label="Reminder emails" hint="Emails everyone going the day before and on the day" checked={s.reminders} onChange={(v) => setting("reminders", v)} />
          </Section>

          {/* Save */}
          <div className="sticky bottom-3 z-10 space-y-3 rounded-3xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur">
            <FormError message={error} />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="sm:w-auto sm:flex-1" onClick={() => save("published")} loading={pending} loadingText="Saving…" disabled={streamBad}>
                {saved ? <><Check size={18} /> Saved</> : night?.status === "published" ? "Save changes" : "Publish event"}
              </Button>
              {night?.status !== "published" && (
                <Button size="lg" variant="secondary" className="sm:w-auto sm:flex-1" onClick={() => save("draft")} disabled={pending || streamBad}>
                  Save as draft
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-8">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted"><Eye size={15} /> How members see it</p>
            <div className="overflow-hidden rounded-[28px] bg-surface shadow-lift">
              <div className={clsx("relative min-h-[170px] overflow-hidden bg-gradient-to-br p-6 text-white", themeBg(f.theme))}>
                {f.coverUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                  </>
                )}
                <span aria-hidden className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
                <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur">
                  <KindIcon kind={f.kind} size={12} /> {kindLabel(f.kind)}
                </span>
                {!f.coverUrl && (
                  <span className="absolute top-5 right-5 animate-float text-white/90">
                    <KindIcon kind={f.kind} size={40} />
                  </span>
                )}
                <p className="relative mt-4 font-display text-[26px] leading-tight font-semibold">{f.title || "Your event's title"}</p>
                <p className="relative mt-1 text-[14px] text-white/80">{startsIso ? eventWhen(startsIso, new Date(new Date(startsIso).getTime() + f.duration * 60000).toISOString()) : "Pick a time"}</p>
              </div>
              <div className="space-y-3 p-5">
                {f.description && <p className="text-[14px] leading-relaxed text-ink-soft">{f.description}</p>}
                <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1">{INTENT_ICONS[f.intent as "dating"]({ size: 13 })} {intentLabel(f.intent as "dating")}</span>
                  <span className="rounded-full bg-cream px-2.5 py-1">Ages {f.ageMin}–{f.ageMax}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[#8a5a00]">
                    {f.entryKeys > 0 ? <><KeyCoin size={13} /> {plural(f.entryKeys, "Key")}</> : "Free"}
                  </span>
                  {choose && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand">{s.free_reveals} free reveals</span>}
                </div>
                <div className="h-12 rounded-2xl bg-brand text-center text-[15px] leading-[48px] font-semibold text-white">I&apos;m going</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card lg:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[17px] leading-tight font-semibold">{title}</h2>
          {hint && <p className="text-[12px] text-muted">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{label}</p>
        {hint && <p className="text-[12px] text-muted">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** Cover picture: uploads straight to storage, shows a preview, can be removed. */
function CoverPicker({ eventId, url, savedUrl, onChange }: { eventId: string | null; url: string; savedUrl: string | null; onChange: (u: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setError(null);
    setBusy(file.name);
    try {
      const up = await uploadEventFile(eventId, file, "image");
      if (url && url !== savedUrl) discardEventUpload(url); // replaced before saving
      onChange(up.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  function clear() {
    if (url && url !== savedUrl) discardEventUpload(url);
    onChange("");
  }

  return (
    <div>
      <Label>Cover picture <span className="font-normal text-muted">· optional</span></Label>
      {url ? (
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Cover" className="aspect-[16/9] w-full object-cover" />
          <div className="absolute right-2 bottom-2 flex gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13px] font-semibold text-ink shadow backdrop-blur">
              {busy ? <Spinner className="h-4 w-4" /> : <ImagePlus size={15} />} Change
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <button type="button" onClick={clear} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13px] font-semibold text-chili shadow backdrop-blur">
              <Trash2 size={15} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <label className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-cream/50 p-4 transition hover:border-brand hover:bg-brand-soft/40", busy && "pointer-events-none")}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-brand">{busy ? <Spinner /> : <ImagePlus size={20} />}</span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{busy ? `Uploading ${busy}…` : "Add a cover picture"}</span>
            <span className="block text-[12px] text-muted">JPG, PNG or WebP · up to 10 MB · wide pictures look best</span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}
      {error && <p className="mt-2 text-[13px] font-medium text-chili">{error}</p>}
      {!url && <p className="mt-1.5 text-[12px] text-muted">No picture? The card colour below is used.</p>}
    </div>
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
