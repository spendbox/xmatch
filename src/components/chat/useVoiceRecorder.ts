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

/** Records a voice note from the microphone. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const resolver = useRef<((b: { blob: Blob; seconds: number } | null) => void) | null>(null);
  const started = useRef(0);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
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
        const secs = Math.round((Date.now() - started.current) / 1000);
        const blob = new Blob(chunks.current, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
        resolver.current?.(blob.size ? { blob, seconds: secs } : null);
        resolver.current = null;
      };
      r.start(250);
      rec.current = r;
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const secs = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(secs);
        if (secs >= MAX_SECONDS) r.state === "recording" && r.stop();
      }, 250);

      // Little level meter so you can see it's hearing you
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const src = ctx.createMediaStreamSource(s);
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteFrequencyData(data);
          setLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
          raf.current = requestAnimationFrame(tick);
        };
        tick();
        s.getTracks()[0].addEventListener("ended", () => ctx.close());
      }
      return true;
    } catch {
      setError("Allow microphone access to send voice notes.");
      showMediaHelp("audio");
      cleanup();
      return false;
    }
  }, [cleanup]);

  /** Stops and returns the recording. */
  const stop = useCallback(() => {
    return new Promise<{ blob: Blob; seconds: number } | null>((resolve) => {
      const r = rec.current;
      if (!r || r.state !== "recording") return resolve(null);
      resolver.current = resolve;
      r.stop();
      cleanup();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const r = rec.current;
    resolver.current = null;
    if (r && r.state === "recording") r.stop();
    cleanup();
  }, [cleanup]);

  return { recording, seconds, level, error, start, stop, cancel, maxSeconds: MAX_SECONDS };
}
