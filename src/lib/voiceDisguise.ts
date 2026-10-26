"use client";

/**
 * Masked voice notes: the voice is disguised here, on the phone, and only the disguised
 * sound is ever uploaded. Plain Web Audio, so it costs nothing to run.
 */
export type VoiceStyle = "normal" | "deep" | "light" | "robot";

/** The disguises (Normal is your own voice: only in chats where you've unmasked) */
export const VOICE_STYLES: { id: VoiceStyle; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "deep", label: "Deep" },
  { id: "light", label: "Light" },
  { id: "robot", label: "Robot" },
];
export const MASKED_STYLES = VOICE_STYLES.filter((v) => v.id !== "normal");

// Clear speech; long notes use a slightly lower rate so a 5 minute note stays small (about 10 MB)
const RATE = 22050;
const LONG_RATE = 16000;

type AC = typeof AudioContext;
type OAC = typeof OfflineAudioContext;
const audioCtx = (): AC => window.AudioContext || (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
const offlineCtx = (): OAC => window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: OAC }).webkitOfflineAudioContext;

/** Turn the recording into sound we can change */
export async function decodeRecording(blob: Blob): Promise<AudioBuffer> {
  // Decode at a speech rate, not the phone's 48 kHz, so a 5 minute note doesn't fill the memory
  let ctx: AudioContext;
  try {
    ctx = new (audioCtx())({ sampleRate: RATE });
  } catch {
    ctx = new (audioCtx())();
  }
  try {
    const data = await blob.arrayBuffer();
    return await new Promise<AudioBuffer>((resolve, reject) => {
      // Older Safari only has the callback version
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && typeof p.then === "function") p.then(resolve, reject);
    });
  } finally {
    void ctx.close().catch(() => {});
  }
}

/** The disguised voice, as a WAV file, and how long it is */
export async function disguise(src: AudioBuffer, style: VoiceStyle): Promise<{ blob: Blob; seconds: number }> {
  const rate = style === "deep" ? 0.78 : style === "light" ? 1.28 : style === "robot" ? 0.96 : 1;
  const tail = 0;
  // 16 kHz is plenty for a voice and keeps files small (a minute is about 2 MB)
  const outRate = LONG_RATE;
  const length = Math.ceil((src.duration / rate + tail) * outRate);
  const ctx = new (offlineCtx())(1, Math.max(1, length), outRate);

  const s = ctx.createBufferSource();
  s.buffer = src;
  s.playbackRate.value = rate;
  let out: AudioNode = s;

  if (style === "deep") {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    out.connect(lp);
    out = lp;
  }
  if (style === "robot") {
    // Ring modulation: the voice times a low hum, which hides who it is
    const ring = ctx.createGain();
    ring.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.frequency.value = 60;
    osc.connect(ring.gain);
    osc.start();
    out.connect(ring);
    const boost = ctx.createGain();
    boost.gain.value = 1.6;
    ring.connect(boost);
    out = boost;
  }
  const gain = ctx.createGain();
  gain.gain.value = 0.95;
  out.connect(gain);
  gain.connect(ctx.destination);
  s.start();

  const rendered = await ctx.startRendering();
  return { blob: toWav(rendered), seconds: Math.max(1, Math.round(rendered.duration - tail)) };
}

/** 16-bit mono WAV (plays everywhere, iPhone included) */
function toWav(buf: AudioBuffer): Blob {
  const ch = buf.getChannelData(0);
  // Keep it loud enough without clipping
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const scale = peak > 0 ? Math.min(4, 0.9 / peak) : 1;
  const data = new DataView(new ArrayBuffer(44 + ch.length * 2));
  const str = (o: number, t: string) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + ch.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) {
    const v = Math.max(-1, Math.min(1, ch[i] * scale));
    data.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([data], { type: "audio/wav" });
}

/** Where a masked voice note plays from */
export function voiceUrl(key: string | undefined | null) {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  return key && base ? `${base}/${key}` : null;
}
