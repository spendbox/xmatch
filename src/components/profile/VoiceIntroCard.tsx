"use client";

import { useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";
import { VoiceIntroSheet } from "@/components/home/VoiceIntro";
import { formatDuration } from "@/lib/chatMedia";
import { VOICE_STYLES } from "@/lib/voiceDisguise";
import { playIntro, usePlayingIntro } from "@/lib/voiceIntro";

/** Profile: your voice intro (record, listen, change). It plays from Hear me on your Explore card */
export function VoiceIntroCard({ initial, demo }: { initial: { key: string | null; seconds: number | null; style: string | null }; demo?: boolean }) {
  const [intro, setIntro] = useState<{ key: string | null; seconds: number | null; style: string | null; src?: string | null }>(initial);
  const [open, setOpen] = useState(false);
  const playing = usePlayingIntro() === intro.key && !!intro.key;
  const voice = VOICE_STYLES.find((v) => v.id === intro.style)?.label;

  return (
    <section className="mt-3 flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card">
      {intro.key ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            playIntro(intro.key!, intro.src ?? undefined);
          }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand text-white"
          aria-label={playing ? "Pause your voice intro" : "Play your voice intro"}
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand">
          <Mic size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Voice intro</p>
        <p className="truncate text-[13px] text-muted">
          {intro.key
            ? `${formatDuration(intro.seconds ?? 0)} · ${voice === "Normal" ? "your real voice" : `${voice ?? "disguised"} voice`} · on your Explore card`
            : "Say hi in 10 seconds. People hear it from your card."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          setOpen(true);
        }}
        className="inline-flex h-9 shrink-0 items-center rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white active:scale-95"
      >
        {intro.key ? "Change" : "Record"}
      </button>
      <VoiceIntroSheet open={open} onClose={() => setOpen(false)} current={intro} onSaved={setIntro} demo={demo} />
    </section>
  );
}
