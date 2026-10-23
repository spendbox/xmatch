// Ringtones made with the browser's sound engine, so no audio files are needed.
import { haptic } from "@/lib/haptics";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Phones only allow sound after you've touched the page, so an incoming call that
 * arrives later would ring silently. Wake the sound engine on the first tap and keep it.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const wake = () => {
    const c = audio();
    if (!c) return;
    // A silent blip is enough to unlock it on iPhones
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(c.destination);
    const o = c.createOscillator();
    o.connect(g);
    o.start();
    o.stop(c.currentTime + 0.01);
    if (c.state === "running") {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    }
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
}

function beep(freqs: number[], start: number, length: number, volume: number) {
  if (!ctx || !out) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + length - 0.05);
  gain.gain.linearRampToValueAtTime(0, start + length);
  gain.connect(out);
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start(start);
    o.stop(start + length);
  }
}

/** "ring" = someone is calling you. "ringback" = you're calling, waiting for an answer. */
export function startTone(kind: "ring" | "ringback") {
  stopTone();
  const c = audio();
  if (c) {
    out = c.createGain();
    out.connect(c.destination);
  }
  const play = () => {
    if (kind === "ring") haptic([400, 200, 400]);
    if (!ctx || !out) return;
    const t = ctx.currentTime + 0.05;
    if (kind === "ring") {
      beep([660, 880], t, 0.35, 0.16);
      beep([660, 880], t + 0.5, 0.35, 0.16);
    } else {
      beep([440, 480], t, 1.6, 0.06);
    }
  };
  if (kind === "ringback") haptic(15);
  play();
  loop = setInterval(play, kind === "ring" ? 2200 : 4000);
}

export function stopTone() {
  if (loop) clearInterval(loop);
  loop = null;
  try {
    if ("vibrate" in navigator) navigator.vibrate(0);
  } catch {
    /* ignore */
  }
  // Cut the sound straight away but keep the engine awake for the next call
  out?.disconnect();
  out = null;
}

/** A short sound and buzz when a call connects or ends */
export function callCue(kind: "connected" | "ended") {
  haptic(kind === "connected" ? [20, 60, 20] : 40);
  const c = audio();
  if (!c) return;
  const g = c.createGain();
  g.connect(c.destination);
  const t = c.currentTime + 0.02;
  const notes = kind === "connected" ? [523, 784] : [660, 440];
  notes.forEach((f, k) => {
    const s = t + k * 0.14;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.12, s + 0.02);
    gain.gain.linearRampToValueAtTime(0, s + 0.16);
    gain.connect(g);
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start(s);
    o.stop(s + 0.18);
  });
}
