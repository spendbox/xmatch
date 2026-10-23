"use client";

/**
 * A soft two-note chime for new messages while Dashpad is open (phones only play
 * their own notification sound when the app is in the background).
 */
let ctx: AudioContext | null = null;
let last = 0;

export function chime() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - last < 1500) return;
  last = now;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, at] of [
      [880, 0],
      [1318.5, 0.11],
    ]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + 0.5);
    }
  } catch {
    /* no audio */
  }
}
