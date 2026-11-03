"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronRight, Flame, Hand, Lock, Mic, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapFeedback, Spinner } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { nameColor } from "@/lib/eventSpace";
import { notify } from "@/lib/pushClient";
import { formatDuration } from "@/lib/chatMedia";
import { useVoiceRecorder } from "@/components/chat/useVoiceRecorder";
import { decodeRecording, disguise, voiceUrl, type VoiceStyle } from "@/lib/voiceDisguise";
import { playIntro, stopIntro, usePlayingIntro } from "@/lib/voiceIntro";
import { shares, timeLeft, type Truth, type TruthVoice } from "@/lib/truths";

const MAX = 30;
const STYLES: { id: VoiceStyle; label: string }[] = [
  { id: "deep", label: "Deep" },
  { id: "light", label: "Light" },
  { id: "robot", label: "Robot" },
  { id: "normal", label: "Real voice" },
];

/** Today's Truth: loads it, and keeps it fresh when it changes over */
export function useTruth(demo?: Truth | null) {
  const supabase = useMemo(() => createClient(), []);
  const [truth, setTruth] = useState<Truth | null>(demo ?? null);
  const isDemo = demo !== undefined;
  const load = useCallback(() => {
    if (isDemo) return;
    supabase.rpc("truth_today").then(({ data }) => {
      if (data) setTruth(data as Truth);
    });
  }, [supabase, isDemo]);
  useEffect(() => {
    load();
    // Coming back to the app: there may be a new Truth
    const back = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [load]);
  return { truth: truth && !truth.none ? truth : null, setTruth, reload: load };
}

/** Flame and the number of days in a row */
function Streak({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-extrabold", className)}>
      <Flame size={13} className="fill-[#ff9a3d] text-[#ff9a3d]" aria-hidden /> {n}
    </span>
  );
}

/**
 * Above Recent chats: today's question, in full, pointing at the Truth bubble. Once you've answered
 * it becomes one quiet line with how it went.
 */
export function TruthCard({ truth, onOpen }: { truth: Truth; onOpen: () => void }) {
  const open = () => {
    tapFeedback();
    onOpen();
  };
  if (truth.mine) {
    const pct = truth.results ? shares(truth.results.counts, truth.options)[truth.mine.choice] : null;
    return (
      <button type="button" onClick={open} className="mb-1 flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left shadow-card transition active:scale-[0.99]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint text-white">
          <Check size={13} strokeWidth={3.5} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          {pct != null ? `${pct}% agree with you` : "You spilled"}
          {truth.results?.waves ? <span className="text-brand"> · {truth.results.waves} {truth.results.waves === 1 ? "wave" : "waves"}</span> : null}
        </span>
        <Streak n={truth.streak} className="text-[12px] text-[#b5530c]" />
        <ChevronRight size={16} className="shrink-0 text-muted" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className="relative mb-1 block w-full rounded-[22px] bg-[#1a1233] px-4 pt-3 pb-3.5 text-left text-white shadow-[0_16px_30px_-18px_rgba(26,18,51,0.9)] transition active:scale-[0.99]"
      aria-label={`Today's Spill: ${truth.body} Tap to spill`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <span className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-brand/60 blur-2xl" />
      </span>
      <span className="relative flex items-center gap-2">
        <span className="rounded-full bg-gold px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-[#1a1233]">TODAY&apos;S SPILL</span>
        <Streak n={truth.streak} className="text-[12px] text-[#ffcf7a]" />
        <span className="ml-auto text-[11.5px] font-semibold text-white/70">{timeLeft(truth.ends_at)} left</span>
      </span>
      <span className="relative mt-2 block font-display text-[19px] leading-[1.2] font-semibold">{truth.body}</span>
      <span className="relative mt-2 flex items-center gap-1 text-[12.5px] font-bold text-gold">
        Spill it <ChevronRight size={14} />
        <span className="ml-auto font-semibold text-white/60">{truth.total.toLocaleString()} spilled</span>
      </span>
      {/* Points down at the Truth bubble */}
      <span aria-hidden className="absolute -bottom-1.5 left-[30px] h-3.5 w-3.5 rotate-45 rounded-[3px] bg-[#1a1233]" />
    </button>
  );
}

/** First in the Recent chats row: the Truth bubble (it glows and turns while it's waiting for you) */
export function TruthBubble({ truth, onOpen }: { truth: Truth; onOpen: () => void }) {
  const live = !truth.mine;
  return (
    <div className="relative flex w-[60px] shrink-0 flex-col items-center gap-1">
      <style>{`@keyframes dp-truth-spin{to{transform:rotate(360deg)}}@keyframes dp-truth-glow{0%,100%{box-shadow:0 0 0 0 rgba(242,179,61,.55)}50%{box-shadow:0 0 0 7px rgba(242,179,61,0)}}`}</style>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onOpen();
        }}
        className="relative block h-12 w-12 rounded-full active:scale-95"
        style={live ? { animation: "dp-truth-glow 1.8s ease-in-out infinite" } : undefined}
        aria-label={live ? "Today's Spill: spill it" : "Today's Spill: see how everyone answered"}
      >
        <span
          aria-hidden
          className="absolute -inset-[3px] rounded-full"
          style={
            live
              ? { background: "conic-gradient(#f2b33d, #ff6b8a, #8b78f0, #f2b33d)", animation: "dp-truth-spin 2.6s linear infinite" }
              : { background: "#d9d2e3" }
          }
        />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-[#1a1233] ring-2 ring-cream">
          <MaskIcon className="w-7 text-gold" eyes="#1a1233" />
        </span>
        {live ? (
          truth.streak > 0 && (
            <span className="absolute -right-2 -bottom-1 inline-flex h-5 items-center gap-0.5 rounded-full border-[1.5px] border-gold bg-surface px-1.5 text-[10.5px] font-extrabold text-[#b5530c]">
              <Flame size={10} className="fill-[#ff8a3d] text-[#ff8a3d]" aria-hidden />
              {truth.streak}
            </span>
          )
        ) : (
          <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-mint text-white ring-2 ring-cream">
            <Check size={11} strokeWidth={3.5} />
          </span>
        )}
      </button>
      <span className={clsx("w-full truncate text-center text-[11px] leading-[16.5px]", live ? "font-extrabold text-ink" : "font-medium text-muted")}>Spill</span>
    </div>
  );
}

/** Record a voice answer, disguised on the phone */
function VoiceAnswer({ onClip, clip, onBusy }: { onClip: (c: { blob: Blob; seconds: number; url: string; style: VoiceStyle } | null) => void; clip: { url: string; seconds: number; style: VoiceStyle } | null; onBusy?: (busy: boolean) => void }) {
  const [raw, setRaw] = useState<AudioBuffer | null>(null);
  const [style, setStyle] = useState<VoiceStyle>(clip?.style ?? "deep");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const playing = usePlayingIntro() === "truth-mine";

  async function took(r: { blob: Blob; seconds: number } | null) {
    if (!r || r.seconds < 1) return setError("That was too short. Try again.");
    setWorking(true);
    try {
      setRaw(await decodeRecording(r.blob));
    } catch {
      setWorking(false);
      setError("Couldn't read that recording. Try again.");
    }
  }
  // Stops by itself at exactly 30 seconds and keeps what you said
  const voice = useVoiceRecorder({ maxSeconds: MAX, onLimit: (r) => void took(r) });
  const stop = async () => took(await voice.stop());

  // Apply the voice you picked (again when you switch voices)
  useEffect(() => {
    if (!raw) return;
    let live = true;
    setWorking(true);
    disguise(raw, style, MAX)
      .then((r) => {
        if (!live) return;
        // Length is how long you talked (a deep voice plays a little slower)
        onClip({ blob: r.blob, seconds: Math.max(1, Math.min(MAX, Math.round(raw.duration))), url: URL.createObjectURL(r.blob), style });
      })
      .catch(() => live && setError("Couldn't change your voice. Try another one."))
      .finally(() => live && setWorking(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, style]);

  const left = MAX - voice.seconds;
  // The Spill button waits while you're recording or your voice is being got ready
  const busyNow = voice.recording || working;
  useEffect(() => onBusy?.(busyNow), [busyNow, onBusy]);
  useEffect(() => () => onBusy?.(false), [onBusy]);

  return (
    <div className="rounded-[22px] border border-dashed border-white/25 bg-white/[0.06] p-4">
      <div className="flex items-center gap-3">
        {clip && !voice.recording ? (
          <button type="button" onClick={() => playIntro("truth-mine", clip.url)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#1a1233]" aria-label={playing ? "Pause" : "Listen to your answer"}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setError(null);
              stopIntro();
              if (voice.recording) void stop();
              else {
                setRaw(null);
                onClip(null);
                void voice.start();
              }
            }}
            className={clsx("relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-white", voice.recording ? "bg-chili" : "bg-[#ff6b8a]")}
            aria-label={voice.recording ? "Stop recording" : "Record a voice answer"}
          >
            {voice.recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-chili/40" />}
            {voice.recording ? <Square size={18} fill="currentColor" /> : <Mic size={22} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{voice.recording ? `Recording… ${formatDuration(voice.seconds)} / ${formatDuration(MAX)}` : working ? "Getting your voice ready…" : clip ? `Your voice answer · ${formatDuration(clip.seconds)}` : style === "normal" ? "Say why, in your own voice" : "Say why, in your masked voice"}</p>
          <p className="text-[12.5px] text-white/65">{voice.recording ? (left <= 5 ? `Stops in ${left}…` : `Tap to stop. It stops by itself at ${MAX} seconds.`) : style === "normal" ? "Optional. People will hear your real voice, but still not your name or face." : "Optional. Your voice is disguised before it leaves your phone."}</p>
        </div>
        {clip && !voice.recording && (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              stopIntro();
              setRaw(null);
              onClip(null);
              void voice.start();
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10"
            aria-label="Record again"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
      {voice.recording && (
        // Fills up over the 30 seconds
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
          <div className="h-full rounded-full bg-[#ff6b8a]" style={{ width: "100%", transformOrigin: "left", animation: `dp-voice-fill ${MAX}s linear forwards` }} />
          <style>{`@keyframes dp-voice-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            aria-pressed={style === s.id}
            className={clsx("h-9 rounded-full px-3.5 text-[12.5px] font-bold transition", style === s.id ? "bg-white text-[#1a1233]" : "bg-white/10 text-white")}
          >
            {s.label}
          </button>
        ))}
      </div>
      {(error || voice.error) && <p className="mt-2 text-[12.5px] font-semibold text-[#ffb4b4]">{error ?? voice.error}</p>}
    </div>
  );
}

/** Upload a voice answer; returns its key */
async function upload(blob: Blob) {
  const res = await fetch("/api/media/truth", { method: "POST" });
  const link = (await res.json().catch(() => null)) as { key?: string; upload?: string; error?: string } | null;
  if (!res.ok || !link?.key || !link.upload) throw new Error(link?.error || "Couldn't save your voice. Try again.");
  const put = await fetch(link.upload, { method: "PUT", body: blob, headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
  if (!put.ok) throw new Error("Couldn't upload your voice. Check your connection.");
  return link.key;
}

/** One voice answer: play it, and wave */
function VoiceRow({ v, label, onWave, waving }: { v: TruthVoice; label: string; onWave: () => void; waving: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const id = `truth-${v.id}`;
  const playing = usePlayingIntro() === id;
  const counted = useRef(false);
  const bars = useMemo(() => Array.from({ length: 22 }, (_, i) => 4 + ((v.id * 7 + i * 13) % 14)), [v.id]);
  return (
    <div className="flex items-center gap-2.5 rounded-[20px] bg-white/[0.08] p-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: nameColor(v.alias) }}>
        <MaskIcon className="w-7 text-white" eyes={nameColor(v.alias)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">
          {v.alias}
          {v.age ? `, ${v.age}` : ""} <span className="font-semibold text-white/60">· {label}</span>
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              if (v.key) playIntro(id, voiceUrl(v.key) ?? undefined);
              if (!counted.current && v.key) {
                counted.current = true;
                void supabase.rpc("truth_listen", { p_answer: v.id });
              }
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#1a1233]"
            aria-label={playing ? `Pause ${v.alias}'s answer` : `Play ${v.alias}'s answer`}
          >
            {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
          </button>
          <span className="flex h-5 items-center gap-[3px]" aria-hidden>
            {bars.map((h, i) => (
              <span key={i} className={clsx("w-[3px] rounded-full", playing && i < 8 ? "bg-gold" : "bg-white/35")} style={{ height: h }} />
            ))}
          </span>
          <span className="text-[11.5px] font-semibold text-white/60">{formatDuration(v.seconds)}</span>
        </div>
      </div>
      {v.can_wave && (
        <button
          type="button"
          onClick={onWave}
          disabled={v.waved || waving}
          className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95", v.waved ? "bg-mint text-white" : "bg-gold text-[#1a1233]")}
          aria-label={v.waved ? `You waved at ${v.alias}` : `Wave at ${v.alias}`}
        >
          {waving ? <Spinner className="h-4 w-4" /> : v.waved ? <Check size={18} strokeWidth={3} /> : <Hand size={19} />}
        </button>
      )}
    </div>
  );
}

/** Today's Truth, full screen: answer it, then see everyone */
export function TruthSheet({ truth, open, onClose, onChange, demo }: { truth: Truth; open: boolean; onClose: () => void; onChange: (t: Truth) => void; demo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [clip, setClip] = useState<{ blob: Blob; seconds: number; url: string; style: VoiceStyle } | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"same" | "other">("same");
  const [adding, setAdding] = useState(false);
  const [waving, setWaving] = useState<number | null>(null);
  const [mutual, setMutual] = useState<{ alias: string; href: string } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setPick(null);
    setClip(null);
    setVoiceBusy(false);
    setError(null);
    setAdding(false);
    setMutual(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      stopIntro();
    };
  }, [open]);

  async function send(choice: string, withVoice: boolean) {
    if (busy) return;
    tapFeedback();
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        const next = { ...truth, mine: { choice, alias: "Golden Fox", key: withVoice && clip ? "demo" : truth.mine?.key ?? null, seconds: clip?.seconds ?? truth.mine?.seconds ?? null, listens: 0 } };
        onChange({ ...next, streak: truth.streak + (truth.mine ? 0 : 1), results: next.results ?? { counts: { a: 2184, b: 1228 }, women: { a: 1120, b: 460 }, men: { a: 1064, b: 768 }, waves: 0, voices: [] } });
        setAdding(false);
        return;
      }
      const key = withVoice && clip ? await upload(clip.blob) : null;
      const { data, error: err } = await supabase.rpc("answer_truth", { p_truth: truth.id, p_choice: choice, p_key: key, p_seconds: clip ? Math.min(MAX, clip.seconds) : null, p_style: clip?.style ?? null });
      if (err) throw new Error(err.message.replace(/^.*?: /, "").replace(/\bTruth\b/g, "Spill") || "Couldn't save your answer. Try again.");
      onChange(data as Truth);
      setClip(null);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function wave(v: TruthVoice) {
    tapFeedback();
    const mark = () => onChange({ ...truth, results: truth.results && { ...truth.results, voices: truth.results.voices.map((x) => (x.id === v.id ? { ...x, waved: true } : x)) } });
    if (demo) return mark();
    setWaving(v.id);
    setError(null);
    const { data, error: err } = await supabase.rpc("wave_person", { p_id: v.person });
    setWaving(null);
    if (err || !data) return setError(err?.message?.includes("NOT_ENOUGH_KEYS") ? "You don't have enough Keys to wave." : err?.message?.replace(/^.*?: /, "") || "Couldn't wave. Try again.");
    const r = data as { kind: "waved" | "match" | "masked"; id?: string; again?: boolean; mutual?: boolean };
    mark();
    if (r.kind === "waved") {
      if (!r.again) notify({ kind: "wave", personId: v.person });
      return;
    }
    if (r.mutual) notify({ kind: "wave", personId: v.person });
    setMutual({ alias: v.alias, href: r.kind === "match" ? `/matches/${r.id}` : `/masquerade/${r.id}` });
  }

  if (!open || !mounted) return null;
  const mine = truth.mine;
  const labelOf = (id: string) => truth.options.find((o) => o.id === id)?.label ?? "";
  const pct = truth.results ? shares(truth.results.counts, truth.options) : null;
  const sideShare = (side: Record<string, number> | undefined) => {
    if (!side || !mine) return null;
    const total = Object.values(side).reduce((a, b) => a + b, 0);
    return total ? Math.round(((side[mine.choice] ?? 0) / total) * 100) : null;
  };
  const women = sideShare(truth.results?.women);
  const men = sideShare(truth.results?.men);
  const voices = truth.results?.voices ?? [];
  const same = voices.filter((v) => v.same);
  const other = voices.filter((v) => !v.same);
  const shown = tab === "same" ? same : other;

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#1a1233] text-white animate-fade-in" role="dialog" aria-modal="true" aria-label="Today's Spill">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] bg-[radial-gradient(ellipse_at_50%_0%,rgba(91,63,217,0.75),transparent_70%)]" />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(14px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
            <X size={19} />
          </button>
          <p className="flex-1 text-center text-[12.5px] font-extrabold tracking-[0.14em] text-gold">TODAY&apos;S SPILL</p>
          <span className="grid h-11 min-w-11 place-items-center rounded-full bg-white/10 px-3 text-[13px]">
            {truth.streak ? <Streak n={truth.streak} className="text-white" /> : <span className="font-bold text-white/70">{timeLeft(truth.ends_at)}</span>}
          </span>
        </div>

        <h1 className="mt-6 px-1 font-display text-[31px] leading-[1.1] font-semibold [text-wrap:balance]">{truth.body}</h1>

        {mutual ? (
          <div className="mt-10 flex flex-1 flex-col items-center text-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-gold text-[#1a1233] animate-pop">
              <Hand size={36} />
            </span>
            <p className="mt-5 text-[12.5px] font-extrabold tracking-[0.14em] text-gold">IT&apos;S MUTUAL</p>
            <p className="mt-2 font-display text-[30px] leading-tight font-semibold">{mutual.alias} waved back</p>
            <p className="mt-3 max-w-[290px] text-[15px] leading-relaxed text-white/80">Your masked chat is open. You both stay masked until you choose to unmask.</p>
            <div className="mt-auto flex w-full flex-col gap-2.5 pt-8">
              <button type="button" onClick={() => router.push(mutual.href)} className="h-14 rounded-2xl bg-gold text-[16px] font-extrabold text-[#1a1233]">
                Say hi
              </button>
              <button type="button" onClick={() => setMutual(null)} className="h-12 rounded-2xl bg-white/10 text-[15px] font-bold">
                Keep listening
              </button>
            </div>
          </div>
        ) : !mine ? (
          <>
            <p className="mt-2 flex items-start gap-1.5 px-1 text-[14px] font-medium text-white/75"><Lock size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden /> Be honest, your answer is private. Others only see a mask name, never your profile.</p>
            <div className="mt-5 flex flex-col gap-2.5">
              {truth.options.map((o) => {
                const on = pick === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setPick(o.id);
                    }}
                    aria-pressed={on}
                    className={clsx("flex min-h-[60px] items-center gap-3.5 rounded-[22px] border-2 px-4 py-3 text-left transition active:scale-[0.99]", on ? "border-gold bg-gold/15" : "border-white/15 bg-white/[0.05]")}
                  >
                    <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full", on ? "bg-gold text-[#1a1233]" : "border-2 border-white/40")}>{on && <Check size={15} strokeWidth={3.5} />}</span>
                    <span className="text-[18px] font-extrabold">{o.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5">
              <VoiceAnswer clip={clip} onClip={setClip} onBusy={setVoiceBusy} />
            </div>
            {error && <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-[13px] font-medium text-[#ffd0d0]">{error}</p>}
            <div className="mt-auto pt-6">
              <button type="button" onClick={() => pick && void send(pick, !!clip)} disabled={!pick || busy || voiceBusy} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-[16.5px] font-extrabold text-[#1a1233] transition active:scale-[0.99] disabled:opacity-50">
                {busy ? <Spinner className="h-4 w-4" /> : null} Spill it and see everyone
              </button>
              <p className="mt-2.5 text-center text-[12.5px] text-white/55">Only you can see your answers, in My Spills on your Profile.</p>
            </div>
          </>
        ) : (
          <>
            {/* How everyone answered */}
            <div className="mt-5 flex flex-col gap-2.5 rounded-[22px] bg-white/[0.07] p-4">
              {truth.options.map((o) => {
                const p = pct?.[o.id] ?? 0;
                const me = mine.choice === o.id;
                return (
                  <div key={o.id} className="relative h-12 overflow-hidden rounded-[14px] bg-white/[0.08]">
                    <div className={clsx("absolute inset-y-0 left-0 rounded-[14px] transition-[width] duration-700", me ? "bg-gold" : "bg-[#8b78f0]")} style={{ width: `${Math.max(p, 4)}%` }} />
                    <div className={clsx("relative flex h-12 items-center justify-between px-3.5", me && p > 40 ? "text-[#1a1233]" : "text-white")}>
                      <span className="inline-flex items-center gap-1.5 text-[15.5px] font-extrabold">
                        {o.label}
                        {me && <span className={clsx("rounded-full px-1.5 py-px text-[10px] font-extrabold", p > 40 ? "bg-[#1a1233] text-gold" : "bg-gold text-[#1a1233]")}>YOU</span>}
                      </span>
                      <span className="text-[17px] font-extrabold tabular-nums">{p}%</span>
                    </div>
                  </div>
                );
              })}
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold text-white/70">
                {women != null && <span>Women: {women}% {labelOf(mine.choice).toLowerCase()}</span>}
                {men != null && <span>Men: {men}% {labelOf(mine.choice).toLowerCase()}</span>}
                <span className="ml-auto">{truth.total.toLocaleString()} answers</span>
              </p>
            </div>

            {/* Your voice answer, or add one */}
            {mine.key ? (
              <p className="mt-3 rounded-[18px] border border-gold/40 bg-gold/15 px-3.5 py-3 text-[13.5px] font-bold text-[#ffe2a8]">
                Your voice answer: {mine.listens} {mine.listens === 1 ? "listen" : "listens"}
                {truth.results?.waves ? `, ${truth.results.waves} ${truth.results.waves === 1 ? "wave" : "waves"}` : ""}
              </p>
            ) : adding ? (
              <div className="mt-3">
                <VoiceAnswer clip={clip} onClip={setClip} onBusy={setVoiceBusy} />
                <button type="button" onClick={() => void send(mine.choice, true)} disabled={!clip || busy || voiceBusy} className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-[15px] font-extrabold text-[#1a1233] disabled:opacity-50">
                  {busy ? <Spinner className="h-4 w-4" /> : null} Share my voice answer
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-white/[0.08] px-3.5 py-3 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff6b8a]">
                  <Mic size={17} />
                </span>
                <span className="flex-1 text-[14px] font-bold">Add your voice answer</span>
                <ChevronRight size={17} className="text-white/60" />
              </button>
            )}

            {/* Voice answers */}
            <div className="mt-5 flex items-center gap-2">
              <p className="flex-1 text-[17px] font-extrabold">Voice answers</p>
              {(["same", "other"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={clsx("h-9 rounded-full px-3 text-[12.5px] font-bold", tab === k ? "bg-white text-[#1a1233]" : "bg-white/10")}>
                  {k === "same" ? `Same as you · ${same.length}` : `Different · ${other.length}`}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {shown.length ? (
                shown.map((v) => <VoiceRow key={v.id} v={v} label={labelOf(v.choice)} waving={waving === v.id} onWave={() => void wave(v)} />)
              ) : (
                <p className="rounded-[18px] bg-white/[0.06] px-4 py-5 text-center text-[13.5px] text-white/70">
                  {tab === "same" ? "No voice answers like yours yet." : "Nobody who answered differently has shared their voice yet."}
                </p>
              )}
            </div>
            {error && <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-[13px] font-medium text-[#ffd0d0]">{error}</p>}
            <p className="mt-5 text-center text-[12.5px] text-white/55">The next Spill is up in {timeLeft(truth.ends_at)}. Keep your streak going.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
