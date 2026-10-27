"use client";

// Design previews for living brushes and drawing together (sample data, not wired up)
import { useEffect, useRef } from "react";
import { ArrowLeft, Pencil, SendHorizontal, Undo2 } from "lucide-react";
import { ScribbleView } from "@/components/stickers/Scribble";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { BRUSHES, drawScribble, timeline, type Drawing, type Stroke } from "@/lib/scribble";

const line = (pts: [number, number][], b: Stroke["b"], c: string, s: number): Stroke => {
  const p: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 5));
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) p.push(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps), 16);
  }
  return { b, c, s, p };
};
const curve = (f: (t: number) => [number, number], n = 50) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

/** One of each living brush */
export const livingSample: Drawing = {
  v: 1,
  strokes: [
    line(curve((t) => [40 + t * 220, 60 + Math.sin(t * Math.PI * 3) * 18]), "wobble", "#5b6cff", 9),
    line(curve((t) => [40 + t * 220, 120 - Math.sin(t * Math.PI) * 20]), "fire", "#ff4d1a", 12),
    line(curve((t) => [50 + t * 200, 180 + Math.sin(t * Math.PI * 2) * 14], 30), "hearts", "#ff4d7e", 15),
    line(curve((t) => [50 + t * 200, 240 - Math.sin(t * Math.PI * 2) * 14], 30), "stars", "#ffb02e", 15),
  ],
};

// Two people's lines: yours (pink neon) and Ada's (teal), drawn together
const together: Drawing = {
  v: 1,
  strokes: [
    line(curve((t) => [150 + 70 * Math.pow(Math.sin(t * Math.PI * 2), 3), 140 - (55 * Math.cos(t * Math.PI * 2) - 20 * Math.cos(4 * Math.PI * t) - 8 * Math.cos(6 * Math.PI * t))], 70), "neon", "#ff7aa8", 10),
    line(curve((t) => [60 + t * 180, 250 - Math.sin(t * Math.PI) * 26]), "rainbow", "#000", 10),
    line(curve((t) => [235 + Math.cos(t * Math.PI * 2) * 22, 60 + Math.sin(t * Math.PI * 2) * 22], 30), "wobble", "#2fb3a0", 8),
  ],
};
const adaPart: Drawing = { v: 1, strokes: [together.strokes[2]] };

function Board({ size, drawing, cursor }: { size: number; drawing: Drawing; cursor?: { x: number; y: number; name: string; color: string } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = size * 2;
    c.height = size * 2;
    let raf = 0;
    const frame = (now: number) => {
      drawScribble(ctx, drawing, Infinity, timeline(drawing).times, { shadow: false, t: now });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, drawing]);
  return (
    <div className="relative mx-auto rounded-[28px] bg-[#f6f2fd] ring-1 ring-brand/15" style={{ width: size, height: size }}>
      <canvas ref={ref} style={{ width: size, height: size }} className="block" />
      {cursor && (
        <span className="pointer-events-none absolute flex items-center gap-1" style={{ left: (cursor.x / 300) * size, top: (cursor.y / 300) * size }}>
          <span className="h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full ring-4 ring-white" style={{ background: cursor.color }} />
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold text-white shadow-card" style={{ background: cursor.color }}>
            {cursor.name}
          </span>
        </span>
      )}
    </div>
  );
}

const Avatar = ({ letter, color, live }: { letter: string; color: string; live?: boolean }) => (
  <span className="relative grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-white ring-2 ring-surface" style={{ background: color }}>
    {letter}
    {live && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-surface" />}
  </span>
);

/** Living brushes: the pad's 8 brushes, and each living one in a chat */
export function LivingBrushesMock() {
  return (
    <div className="min-h-dvh bg-cream p-4">
      <p className="mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">8 brushes</p>
      <div className="grid grid-cols-4 gap-1.5">
        {BRUSHES.map((b) => (
          <span key={b.id} className="grid h-12 place-items-center rounded-2xl bg-surface text-[12px] font-semibold text-ink-soft shadow-card">
            {b.name}
          </span>
        ))}
      </div>
      <p className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">Living brushes, still moving in the chat</p>
      <div className="grid place-items-center rounded-3xl bg-surface p-3 shadow-card" data-living>
        <Board size={330} drawing={livingSample} />
      </div>
      <p className="mt-2 text-center text-[12.5px] text-muted">Wobbly boils like a cartoon · Fire flickers · Hearts beat · Stars twinkle and turn</p>
    </div>
  );
}

/** Drawing together: 1 their live scribble in the chat, 2 the shared board, 3 what's sent */
export function TogetherMock({ step }: { step: 1 | 2 | 3 }) {
  if (step === 2)
    return (
      <div className="flex h-dvh flex-col bg-surface">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button className="grid h-10 w-10 place-items-center rounded-full text-ink-soft" aria-label="Back">
            <ArrowLeft size={21} />
          </button>
          <div className="flex -space-x-2">
            <Avatar letter="Y" color="#ff7aa8" live />
            <Avatar letter="A" color="#2fb3a0" live />
          </div>
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[16px] leading-tight font-semibold">Drawing with Ada</p>
            <p className="text-[12px] font-semibold text-mint">Both here · drawing live</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center px-3">
          <Board size={366} drawing={together} cursor={{ x: 236, y: 92, name: "Ada", color: "#2fb3a0" }} />
          <div className="mt-3 flex items-center justify-center gap-4 text-[12.5px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-[#e2558a]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff7aa8]" /> Your lines
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#1f8c7d]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2fb3a0]" /> Ada&apos;s lines
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {BRUSHES.map((b) => (
              <span key={b.id} className={"grid h-11 place-items-center rounded-2xl text-[11.5px] font-semibold " + (b.id === "neon" ? "bg-ink text-white" : "bg-cream text-ink-soft")}>
                {b.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 px-4 pt-3 pb-6">
          <button className="grid h-12 w-12 place-items-center rounded-full border border-line text-ink-soft" aria-label="Undo">
            <Undo2 size={19} />
          </button>
          <button className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-[15.5px] font-semibold text-white">
            <SendHorizontal size={18} /> Send from both of us · <KeyCoin size={18} /> 1
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5">
        <ArrowLeft size={22} />
        <Avatar letter="A" color="#2fb3a0" live />
        <div>
          <p className="text-[16px] font-semibold">Ada</p>
          <p className="text-[12px] font-semibold text-mint">{step === 1 ? "scribbling…" : "Online"}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <div className="max-w-[78%] self-start rounded-[20px] rounded-bl-md bg-surface px-4 py-2.5 text-[15px] shadow-card">Wait, let me draw you something</div>
        {step === 1 ? (
          <div className="w-[230px] self-start overflow-hidden rounded-[24px] bg-surface shadow-card">
            <div className="flex items-center gap-2 px-3.5 pt-3">
              <Pencil size={15} className="text-[#1f8c7d]" />
              <span className="text-[13px] font-semibold text-[#1f8c7d]">Ada is scribbling…</span>
              <span className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2fb3a0]" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            </div>
            <div className="p-2">
              <Board size={212} drawing={adaPart} cursor={{ x: 190, y: 104, name: "Ada", color: "#2fb3a0" }} />
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
              <button className="h-10 rounded-full bg-cream text-[13.5px] font-semibold text-ink-soft">Just watch</button>
              <button className="h-10 rounded-full bg-[#2fb3a0] text-[13.5px] font-semibold text-white">Draw together</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <ScribbleView drawing={together} size={190} />
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-muted shadow-card">
              ✍️ Drawn by you &amp; Ada
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-surface px-3 pt-2.5 pb-6">
        <span className="flex h-11 flex-1 items-center rounded-full border border-line bg-cream px-4 text-[15px] text-muted">Message Ada</span>
      </div>
    </div>
  );
}

