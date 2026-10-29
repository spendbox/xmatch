"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Mic, Pause, Play, RotateCcw, Send, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { formatDuration } from "@/lib/chatMedia";
import { decodeRecording, disguise, VOICE_STYLES, type VoiceStyle } from "@/lib/voiceDisguise";
import { VoiceIcon } from "./VoiceIcon";
import type { ChatMessage } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Spinner, tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useVoiceRecorder } from "./useVoiceRecorder";

const MAX = 300;
const VOICE_KEY = "dp_voice_style";

/**
 * A masked voice note: record (up to 5 minutes), pick a voice, listen, send.
 * The disguise happens on this phone; only the voice you pick is uploaded
 * (Normal is your own voice, for when you're happy for them to hear it).
 */
export function MaskedVoiceSheet({
  open,
  onClose,
  sessionId,
  onSent,
  demo,
  onSendBlob,
  allowNormal,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  /** The voice note was sent (to show it straight away, or open the chat) */
  onSent?: (m: ChatMessage) => void;
  /** Design previews: start on the "listen" step */
  demo?: boolean;
  /** Chats where you've unmasked: send it your own way (your normal voice is an option there) */
  onSendBlob?: (blob: Blob, seconds: number, style: VoiceStyle) => Promise<string | null>;
  allowNormal?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const voice = useVoiceRecorder();
  const [raw, setRaw] = useState<AudioBuffer | null>(null);
  // The recording as the phone made it (small and compressed): sent as is for your normal voice
  const original = useRef<{ blob: Blob; seconds: number } | null>(null);
  const styles = VOICE_STYLES;
  const [style, setStyle] = useState<VoiceStyle>(() => {
    try {
      const saved = localStorage.getItem(VOICE_KEY) as VoiceStyle | null;
      // Echo was removed. In a masked chat it starts disguised: your own voice is always a choice you make each time
      if (!allowNormal && saved === "normal") return "deep";
      return saved && styles.some((v) => v.id === saved) ? saved : allowNormal ? "normal" : "deep";
    } catch {
      return allowNormal ? "normal" : "deep";
    }
  });
  const [out, setOut] = useState<{ blob: Blob; seconds: number; url: string } | null>(null);
  const [busy, setBusy] = useState<"disguise" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const step = demo ? "ready" : voice.recording ? "recording" : out || raw ? "ready" : "idle";

  // Start fresh each time it opens
  useEffect(() => {
    if (!open) return;
    setRaw(null);
    setOut(null);
    setError(null);
    setPlaying(false);
  }, [open]);

  // Up to 5 minutes
  useEffect(() => {
    if (voice.recording && voice.seconds >= MAX) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording, voice.seconds]);

  // A new voice picked: disguise it again
  useEffect(() => {
    if (!raw) return;
    let live = true;
    setBusy("disguise");
    disguise(raw, style)
      .then((r) => {
        if (!live) return;
        setOut((o) => {
          if (o) URL.revokeObjectURL(o.url);
          return { ...r, url: URL.createObjectURL(r.blob) };
        });
      })
      .catch(() => live && setError("Couldn't change the voice on this phone. Try recording again."))
      .finally(() => live && setBusy(null));
    try {
      localStorage.setItem(VOICE_KEY, style);
    } catch {}
    return () => {
      live = false;
    };
  }, [raw, style]);

  async function record() {
    tapFeedback();
    setError(null);
    setOut(null);
    setRaw(null);
    await voice.start();
  }

  async function stop() {
    const r = await voice.stop();
    original.current = r ?? null;
    if (!r || r.seconds < 1) return setError("That was too short. Hold on a little longer.");
    try {
      setBusy("disguise");
      setRaw(await decodeRecording(r.blob));
    } catch {
      setBusy(null);
      setError("Couldn't read that recording. Try again.");
    }
  }

  function toggle() {
    const a = player.current;
    if (!a) return;
    if (a.paused) void a.play().then(() => setPlaying(true)).catch(() => {});
    else {
      a.pause();
      setPlaying(false);
    }
  }

  async function send() {
    if (!out || busy) return;
    setBusy("send");
    setError(null);
    if (onSendBlob) {
      // Your own voice: the phone's compressed recording, about a tenth of the size of a disguised one
      const plain = style === "normal" && original.current ? original.current : null;
      const e = await onSendBlob(plain ? plain.blob : out.blob, plain ? Math.max(1, plain.seconds) : out.seconds, style);
      setBusy(null);
      if (e) return setError(e);
      onClose();
      return;
    }
    try {
      const res = await fetch("/api/media/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const link = (await res.json().catch(() => null)) as { key?: string; upload?: string; error?: string } | null;
      if (!res.ok || !link?.key || !link.upload) throw new Error(link?.error || "Couldn't send. Try again.");
      const put = await fetch(link.upload, { method: "PUT", body: out.blob, headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
      if (!put.ok) throw new Error("Couldn't upload. Check your connection and try again.");
      const { data, error: err } = await supabase.rpc("send_masked_voice", { p_session: sessionId, p_key: link.key, p_seconds: out.seconds, p_voice: style });
      if (err || !data) throw new Error(err?.message?.replace(/^.*?: /, "") || "Couldn't send. Try again.");
      notify({ kind: "masked_message", sessionId });
      onSent?.(data as ChatMessage);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function close() {
    voice.cancel();
    player.current?.pause();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={allowNormal ? "Voice note" : "Masked voice note"}
      subtitle={
        allowNormal
          ? "Send your own voice, or disguise it for fun. Disguises happen on your phone."
          : "Disguise your voice, or pick Normal to send your own. Disguises happen on your phone."
      }
      icon={allowNormal ? <VoiceIcon style="normal" size={24} className="text-brand" /> : <MaskIcon className="w-6" />}
    >
      <div className="space-y-5 pb-1">
        {/* Record */}
        {step !== "ready" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={step === "recording" ? stop : record}
              className={clsx(
                "relative grid h-24 w-24 place-items-center rounded-full text-white shadow-lift transition active:scale-95",
                step === "recording" ? "bg-chili" : "bg-brand",
              )}
              aria-label={step === "recording" ? "Stop recording" : "Start recording"}
            >
              {step === "recording" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-chili/40" />}
              {step === "recording" ? <Square size={30} fill="currentColor" /> : <Mic size={36} />}
            </button>
            <p className="text-[15px] font-semibold tabular-nums">
              {step === "recording" ? `${formatDuration(voice.seconds)} / ${formatDuration(MAX)}` : "Tap to record"}
            </p>
            <p className="max-w-[260px] text-center text-[12.5px] text-muted">
              {step === "recording" ? "Tap again to stop" : "Dashpad only listens while you're recording. Up to 5 minutes."}
            </p>
          </div>
        )}

        {/* Listen, change the voice, send */}
        {step === "ready" && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3">
              <button
                type="button"
                onClick={toggle}
                disabled={!out || busy === "disguise"}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-60"
                aria-label={playing ? "Pause" : "Listen"}
              >
                {busy === "disguise" ? <Spinner className="h-5 w-5" /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-brand-ink">{busy === "disguise" ? (style === "normal" ? "Getting it ready…" : "Disguising your voice…") : "Listen to how you sound"}</p>
                <p className="text-[12.5px] text-muted">{out ? formatDuration(out.seconds) : demo ? "0:12" : "…"} · {VOICE_STYLES.find((v) => v.id === style)?.label} voice</p>
              </div>
              {out && <audio ref={player} src={out.url} onEnded={() => setPlaying(false)} preload="auto" />}
            </div>

            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted">Pick a voice</p>
              <div className="grid grid-cols-4 gap-2">
                {styles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      player.current?.pause();
                      setPlaying(false);
                      setStyle(v.id);
                    }}
                    aria-pressed={style === v.id}
                    className={clsx(
                      "flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[12.5px] font-semibold transition active:scale-95",
                      style === v.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft",
                    )}
                  >
                    <VoiceIcon style={v.id} size={26} />
                    {v.label}
                  </button>
                ))}
              </div>
              {!allowNormal && style === "normal" && (
                <p className="mt-2 text-[12.5px] font-medium text-muted">They'll hear your real voice, even though you're still masked.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={record} disabled={!!busy} className="w-auto! shrink-0 px-4">
                <RotateCcw size={18} /> Redo
              </Button>
              <Button size="lg" onClick={send} loading={busy === "send"} loadingText="Sending…" disabled={!out || !!busy} className="min-w-0 flex-1">
                <Send size={18} /> Send
              </Button>
            </div>
          </>
        )}

        {(error || voice.error) && <p className="text-center text-[13px] font-medium text-chili">{error ?? voice.error}</p>}
      </div>
    </Sheet>
  );
}
