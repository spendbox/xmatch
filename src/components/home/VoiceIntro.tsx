"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Mic, Pause, Play, RotateCcw, Square, Trash2, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { VoiceIcon } from "@/components/chat/VoiceIcon";
import { useVoiceRecorder } from "@/components/chat/useVoiceRecorder";
import { decodeRecording, disguise, VOICE_STYLES, type VoiceStyle } from "@/lib/voiceDisguise";
import { formatDuration } from "@/lib/chatMedia";
import { playIntro, stopIntro, usePlayingIntro } from "@/lib/voiceIntro";

const MAX = 10;

/** Sound bars that move while it plays */
function Bars() {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      <style>{`@keyframes dp-intro-bar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}`}</style>
      {[0.2, 0.5, 0.1, 0.7, 0.35, 0.6, 0.15].map((d, i) => (
        <span key={i} className="block h-full w-[3px] rounded-full bg-white" style={{ animation: `dp-intro-bar .8s ${d}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

/** "Hear me" on someone's photo: plays their voice intro (one at a time across the app) */
export function HearMe({ id, src, seconds, name, compact }: { id: string; src: string; seconds?: number | null; name: string; /** Smaller, for Explore cards */ compact?: boolean }) {
  const playing = usePlayingIntro() === id;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        tapFeedback();
        playIntro(id, src);
      }}
      aria-label={playing ? `Stop ${name}'s voice intro` : `Hear ${name}'s voice intro`}
      className={clsx("pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-ink/55 font-semibold text-white backdrop-blur transition active:scale-95", compact ? "h-7 pr-2.5 pl-1 text-[11px]" : "h-9 pr-3 pl-1.5 text-[12px]")}
    >
      <span className={clsx("grid place-items-center rounded-full bg-white text-ink", compact ? "h-5 w-5" : "h-6 w-6")}>
        {playing ? <Pause size={12} fill="currentColor" /> : <Volume2 size={14} />}
      </span>
      {playing ? <Bars /> : `Hear me${seconds ? ` · ${formatDuration(seconds)}` : ""}`}
    </button>
  );
}

type Intro = { key: string | null; seconds: number | null; style: string | null; src?: string | null };

/**
 * Record your voice intro: up to 10 seconds, disguised on your phone, or your real voice if you
 * pick Normal. It plays from "Hear me" on your Explore card.
 */
export function VoiceIntroSheet({ open, onClose, current, onSaved, demo }: { open: boolean; onClose: () => void; current: Intro; onSaved: (i: Intro) => void; demo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const voice = useVoiceRecorder();
  const [raw, setRaw] = useState<AudioBuffer | null>(null);
  const [style, setStyle] = useState<VoiceStyle>("deep");
  const [clip, setClip] = useState<{ blob: Blob; seconds: number; url: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playing = usePlayingIntro();

  useEffect(() => {
    if (!open) return;
    setRaw(null);
    setClip(null);
    setError(null);
    setStyle((current.style as VoiceStyle) || "deep");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A new voice picked: disguise it again (Normal keeps your own voice)
  useEffect(() => {
    if (!raw) return;
    let live = true;
    disguise(raw, style).then((r) => {
      if (!live) return;
      setClip((c) => {
        if (c) URL.revokeObjectURL(c.url);
        return { ...r, url: URL.createObjectURL(r.blob) };
      });
    });
    return () => {
      live = false;
    };
  }, [raw, style]);

  useEffect(() => {
    if (voice.recording && voice.seconds >= MAX) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording, voice.seconds]);

  async function stop() {
    const r = await voice.stop();
    if (!r || r.seconds < 1) return setError("That was too short. Hold on a little longer.");
    try {
      setRaw(await decodeRecording(r.blob));
    } catch {
      setError("Couldn't read that recording. Try again.");
    }
  }

  function close() {
    voice.cancel();
    stopIntro();
    onClose();
  }

  async function save() {
    if (!clip || busy) return;
    tapFeedback();
    setBusy("save");
    setError(null);
    try {
      if (demo) {
        onSaved({ key: "demo", seconds: clip.seconds, style, src: clip.url });
        return close();
      }
      const res = await fetch("/api/media/intro", { method: "POST" });
      const link = (await res.json().catch(() => null)) as { key?: string; upload?: string; error?: string } | null;
      if (!res.ok || !link?.key || !link.upload) throw new Error(link?.error || "Couldn't save. Try again.");
      const put = await fetch(link.upload, { method: "PUT", body: clip.blob, headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
      if (!put.ok) throw new Error("Couldn't upload. Check your connection and try again.");
      const { error: err } = await supabase.rpc("set_voice_intro", { p_key: link.key, p_seconds: clip.seconds, p_style: style });
      if (err) throw new Error(err.message.replace(/^.*?: /, "") || "Couldn't save. Try again.");
      onSaved({ key: link.key, seconds: clip.seconds, style });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    tapFeedback();
    setBusy("delete");
    if (!demo) {
      const { error: err } = await supabase.rpc("set_voice_intro", { p_key: "" });
      if (err) {
        setBusy(null);
        return setError("Couldn't remove it. Try again.");
      }
    }
    setBusy(null);
    onSaved({ key: null, seconds: null, style: null });
    close();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Your voice intro"
      subtitle="Say hi in up to 10 seconds. It plays from Hear me on your Explore card."
      footer={
        <div className="space-y-2">
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          {clip && (
            <Button size="lg" onClick={save} loading={busy === "save"} loadingText="Saving…">
              Save my intro
            </Button>
          )}
          {!clip && current.key && (
            <button type="button" onClick={remove} disabled={!!busy} className="mx-auto flex h-10 items-center gap-1.5 text-[14px] font-semibold text-chili disabled:opacity-50">
              <Trash2 size={16} /> Remove my intro
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 pb-1">
        {/* Your current intro */}
        {current.key && !clip && !voice.recording && (
          <div className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft p-3">
            <button
              type="button"
              onClick={() => playIntro(current.key!, current.src ?? undefined)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white"
              aria-label={playing === current.key ? "Pause" : "Listen to your intro"}
            >
              {playing === current.key ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <p className="min-w-0 flex-1 text-[14px] font-semibold text-brand-ink">
              Your intro · {formatDuration(current.seconds ?? 0)} · {VOICE_STYLES.find((v) => v.id === current.style)?.label ?? "Disguised"} voice
            </p>
          </div>
        )}

        {/* Record */}
        {(!clip || voice.recording) && (
          <>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                setError(null);
                stopIntro();
                if (voice.recording) void stop();
                else {
                  setRaw(null);
                  setClip(null);
                  void voice.start();
                }
              }}
              className={clsx("relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lift transition active:scale-95", voice.recording ? "bg-chili" : "bg-brand")}
              aria-label={voice.recording ? "Stop recording" : "Start recording"}
            >
              {voice.recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-chili/40" />}
              {voice.recording ? <Square size={26} fill="currentColor" /> : <Mic size={32} />}
            </button>
            <p className="text-[14px] font-semibold tabular-nums">
              {voice.recording ? `${formatDuration(voice.seconds)} / ${formatDuration(MAX)}` : current.key ? "Tap to record a new one" : "Tap to record"}
            </p>
            {voice.error && <p className="text-[13px] text-chili">{voice.error}</p>}
          </>
        )}

        {/* Listen, pick a voice */}
        {clip && !voice.recording && (
          <>
            <div className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft p-3">
              <button
                type="button"
                onClick={() => playIntro("new", clip.url)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white"
                aria-label={playing === "new" ? "Pause" : "Listen"}
              >
                {playing === "new" ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <p className="min-w-0 flex-1 text-[14px] font-semibold text-brand-ink">
                Listen · {formatDuration(clip.seconds)} · {VOICE_STYLES.find((v) => v.id === style)?.label} voice
              </p>
              <button
                type="button"
                onClick={() => {
                  stopIntro();
                  setClip(null);
                  setRaw(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-full text-brand"
                aria-label="Record again"
              >
                <RotateCcw size={18} />
              </button>
            </div>
            <div className="grid w-full grid-cols-4 gap-2">
              {VOICE_STYLES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    stopIntro();
                    setStyle(v.id);
                  }}
                  aria-pressed={style === v.id}
                  className={clsx("flex flex-col items-center gap-1 rounded-2xl border py-2 text-[12px] font-semibold", style === v.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft")}
                >
                  <VoiceIcon style={v.id} size={22} />
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-center text-[12.5px] text-muted">
              {style === "normal" ? "People on Explore will hear your real voice." : "Your voice is disguised on your phone. Pick Normal to use your real voice."}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
