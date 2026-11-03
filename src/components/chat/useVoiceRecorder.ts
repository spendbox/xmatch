"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showMediaHelp } from "@/lib/mediaPermission";

const MAX_SECONDS = 300;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

type Clip = { blob: Blob; seconds: number };

/**
 * Records a voice note from the microphone.
 * maxSeconds: stops by itself right on time and hands the recording to onLimit.
 */
export function useVoiceRecorder(opts: { maxSeconds?: number; onLimit?: (r: Clip | null) => void } = {}) {
  const max = opts.maxSeconds ?? MAX_SECONDS;
  const onLimit = useRef(opts.onLimit);
  onLimit.current = opts.onLimit;
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meter = useRef<AudioContext | null>(null);
  const resolver = useRef<((b: Clip | null) => void) | null>(null);
  const stopping = useRef<Promise<Clip | null> | null>(null);
  const started = useRef(0);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (limit.current) clearTimeout(limit.current);
    timer.current = null;
    limit.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    // Close the level meter's audio, or iPhones run out after a few recordings
    if (meter.current) void meter.current.close().catch(() => {});
    meter.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRecording(false);
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice notes aren't supported in this browser.");
      return false;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const secs = Math.min(max, Math.round((Date.now() - started.current) / 1000));
        const blob = new Blob(chunks.current, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
        resolver.current?.(blob.size ? { blob, seconds: secs } : null);
        resolver.current = null;
      };
      r.start(250);
      rec.current = r;
      stopping.current = null;
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => setSeconds(Math.min(max, Math.floor((Date.now() - started.current) / 1000))), 250);
      // Stop right on the limit, and pass the recording on
      limit.current = setTimeout(() => {
        void stopRef.current().then((clip) => onLimit.current?.(clip));
      }, max * 1000);

      // Little level meter so you can see it's hearing you
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        meter.current = ctx;
        const src = ctx.createMediaStreamSource(s);
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        // About 12 times a second is plenty for the meter (every frame slows the page down)
        let last = 0;
        const tick = (t: number) => {
          if (t - last > 80) {
            last = t;
            an.getByteFrequencyData(data);
            setLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
      return true;
    } catch {
      setError("Allow microphone access to send voice notes.");
      showMediaHelp("audio");
      cleanup();
      return false;
    }
  }, [cleanup, max]);

  /** Stops and returns the recording (tapping stop twice gives the same recording, not an error) */
  const stop = useCallback(() => {
    if (stopping.current) return stopping.current;
    const r = rec.current;
    if (!r || r.state !== "recording") return Promise.resolve(null);
    stopping.current = new Promise<Clip | null>((resolve) => {
      resolver.current = resolve;
      r.stop();
      cleanup();
    });
    return stopping.current;
  }, [cleanup]);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const cancel = useCallback(() => {
    const r = rec.current;
    resolver.current = null;
    if (r && r.state === "recording") r.stop();
    cleanup();
  }, [cleanup]);

  return { recording, seconds, level, error, start, stop, cancel, maxSeconds: max };
}
