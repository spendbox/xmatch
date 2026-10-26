"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Pause, Play } from "lucide-react";
import { formatDuration } from "@/lib/chatMedia";
import { useSignedUrl } from "./useSignedUrl";

/** Voice note player with a simple waveform. */
export function AudioPlayer({
  path,
  localUrl,
  duration,
  mine,
  seed = 1,
}: {
  path?: string | null;
  localUrl?: string;
  duration?: number;
  mine?: boolean;
  seed?: number;
}) {
  const url = useSignedUrl(path, localUrl);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [length, setLength] = useState(duration ?? 0);
  const [current, setCurrent] = useState(0);

  // A stable, natural-looking waveform for each message
  const bars = useMemo(() => {
    let x = seed * 9301 + 49297;
    return Array.from({ length: 28 }, () => {
      x = (x * 9301 + 49297) % 233280;
      return 0.25 + (x / 233280) * 0.75;
    });
  }, [seed]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => {
      setCurrent(a.currentTime);
      const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : length;
      if (d) setProgress(a.currentTime / d);
    };
    const onMeta = () => Number.isFinite(a.duration) && a.duration > 0 && setLength(a.duration);
    // Paused by another voice note starting, or by the phone
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [length, url]);

  function toggle() {
    const a = audio.current;
    if (!a || !url) return;
    // Only one voice note plays at a time
    document.querySelectorAll("audio[data-voice]").forEach((el) => el !== a && (el as HTMLAudioElement).pause());
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.PointerEvent<HTMLDivElement>) {
    const a = audio.current;
    if (!a || !length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    a.currentTime = ratio * length;
    setProgress(ratio);
  }

  return (
    <div className="flex w-[220px] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={clsx(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-50",
          mine ? "bg-white text-brand" : "bg-brand text-white",
        )}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 cursor-pointer items-center gap-[2px]" onPointerDown={seek} role="slider" aria-label="Seek" aria-valuenow={Math.round(progress * 100)}>
          {bars.map((h, i) => (
            <span
              key={i}
              className={clsx(
                "w-[3px] flex-1 rounded-full transition-colors",
                i / bars.length < progress ? (mine ? "bg-white" : "bg-brand") : mine ? "bg-white/40" : "bg-brand/25",
              )}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
        <p className={clsx("mt-0.5 text-[11px] tabular-nums", mine ? "text-white/80" : "text-muted")}>
          {formatDuration(playing || current ? current : length)}
        </p>
      </div>
      {url && <audio ref={audio} src={url} preload="metadata" data-voice />}
    </div>
  );
}
