"use client";

/**
 * Masked voice notes: the voice is disguised here, on the phone, and only the voice
 * picked (disguised, or Normal) is ever uploaded. Plain Web Audio, so it costs nothing to run.
 */
export type VoiceStyle = "normal" | "deep" | "light" | "robot";

/** The voices to pick from (Normal is your own voice, undisguised) */
export const VOICE_STYLES: { id: VoiceStyle; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "deep", label: "Deep" },
  { id: "light", label: "Light" },
  { id: "robot", label: "Robot" },
];

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

/**
 * Stretch speech longer or shorter without changing its pitch (WSOLA: overlapping slices of the
 * voice, each lined up with the last so there's no echo or warble).
 */
function stretchSpeech(x: Float32Array, stretch: number, sr: number): Float32Array {
  const N = Math.round(sr * 0.03); // 30 ms slices
  const hop = Math.floor(N / 2); // 50% overlap on the way out
  const step = hop / stretch; // how far to move through the voice each slice
  const delta = Math.floor(N / 4); // how far we may look to line slices up
  const outLen = Math.ceil(x.length * stretch);
  const out = new Float32Array(outLen + N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  // How well a slice at a lines up with the voice at b (every 4th sample is enough)
  const match = (a: number, b: number) => {
    let sum = 0;
    for (let i = 0; i < N; i += 4) sum += x[a + i] * x[b + i];
    return sum;
  };
  let prev = 0;
  for (let k = 0; ; k++) {
    const at = k * hop;
    if (at >= outLen) break;
    const nominal = Math.round(k * step);
    if (nominal + N + delta >= x.length) break;
    let best = nominal;
    if (k > 0) {
      const target = prev + hop;
      if (target + N < x.length) {
        const lo = Math.max(0, nominal - delta);
        const hi = Math.min(x.length - N - 1, nominal + delta);
        // Rough search, then fine-tune around the best spot
        let bestScore = -Infinity;
        for (let d = lo; d <= hi; d += 8) {
          const sc = match(d, target);
          if (sc > bestScore) {
            bestScore = sc;
            best = d;
          }
        }
        const c = best;
        for (let d = Math.max(lo, c - 7); d <= Math.min(hi, c + 7); d++) {
          const sc = match(d, target);
          if (sc > bestScore) {
            bestScore = sc;
            best = d;
          }
        }
      }
    }
    for (let i = 0; i < N; i++) out[at + i] += x[best + i] * win[i];
    prev = best;
  }
  return out.subarray(0, outLen);
}

/**
 * The disguised voice, as a WAV file, and how long it is.
 * The pitch changes but you talk at your normal speed, so it lasts as long as you spoke.
 * limit: keep only the first this-many seconds of what was said.
 */
export async function disguise(src: AudioBuffer, style: VoiceStyle, limit?: number): Promise<{ blob: Blob; seconds: number }> {
  const said = limit ? Math.min(src.duration, limit) : src.duration;
  const pitch = style === "deep" ? 0.8 : style === "light" ? 1.3 : style === "robot" ? 0.94 : 1;
  // 16 kHz is plenty for a voice and keeps files small (a minute is about 2 MB)
  const outRate = LONG_RATE;
  const length = Math.max(1, Math.ceil(said * outRate));

  // 1. Your voice in one channel at 16 kHz, cut to the limit
  const mono = new (offlineCtx())(1, length, outRate);
  const m = mono.createBufferSource();
  m.buffer = src;
  m.connect(mono.destination);
  m.start(0, 0, said);
  let voice = await mono.startRendering();

  // 2. Lengthen or shorten it (same pitch), so that changing the pitch below lands back on your speed
  if (pitch !== 1) {
    // Played at `pitch` speed, a buffer `pitch` times as long lasts exactly as long as you spoke
    const stretched = stretchSpeech(voice.getChannelData(0), pitch, outRate);
    const buf = mono.createBuffer(1, Math.max(1, stretched.length), outRate);
    buf.getChannelData(0).set(stretched);
    voice = buf;
  }

  // 3. Change the pitch, then the finishing touches
  const ctx = new (offlineCtx())(1, length, outRate);
  const s = ctx.createBufferSource();
  s.buffer = voice;
  s.playbackRate.value = pitch;
  let out: AudioNode = s;

  if (style === "deep") {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3400;
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
  // Take out low rumble (traffic, fans, phone handling)
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 80;
  out.connect(hp);
  const gain = ctx.createGain();
  gain.gain.value = 0.95;
  hp.connect(gain);
  gain.connect(ctx.destination);
  s.start();

  const rendered = await ctx.startRendering();
  return { blob: toWav(rendered), seconds: Math.max(1, Math.round(said)) };
}

/** 16-bit mono WAV (plays everywhere, iPhone included) */
function toWav(buf: AudioBuffer): Blob {
  const ch = buf.getChannelData(0);
  // Keep it loud enough without clipping
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const scale = peak > 0 ? Math.min(2.5, 0.9 / peak) : 1;
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
