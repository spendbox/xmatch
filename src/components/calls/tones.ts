// Ringtones made with the browser's sound engine, so no audio files are needed.

let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;
let vibrateLoop: ReturnType<typeof setInterval> | null = null;

function beep(freqs: number[], start: number, length: number, volume: number) {
  if (!ctx) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + length - 0.05);
  gain.gain.linearRampToValueAtTime(0, start + length);
  gain.connect(ctx.destination);
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
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const play = () => {
      if (!ctx) return;
      const t = ctx.currentTime + 0.05;
      if (kind === "ring") {
        beep([660, 880], t, 0.35, 0.16);
        beep([660, 880], t + 0.5, 0.35, 0.16);
      } else {
        beep([440, 480], t, 1.6, 0.06);
      }
    };
    play();
    loop = setInterval(play, kind === "ring" ? 2200 : 4000);
  } catch {
    /* sound not available */
  }
  if (kind === "ring" && "vibrate" in navigator) {
    navigator.vibrate([400, 200, 400]);
    vibrateLoop = setInterval(() => navigator.vibrate([400, 200, 400]), 2200);
  }
}

export function stopTone() {
  if (loop) clearInterval(loop);
  if (vibrateLoop) clearInterval(vibrateLoop);
  loop = null;
  vibrateLoop = null;
  try {
    if ("vibrate" in navigator) navigator.vibrate(0);
  } catch {
    /* ignore */
  }
  ctx?.close().catch(() => {});
  ctx = null;
}
