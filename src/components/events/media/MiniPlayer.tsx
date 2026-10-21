"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { GripVertical, Minimize2, Music2, Pause, Play, Radio, Video, Volume2, VolumeX, X } from "lucide-react";
import { useEventMedia } from "./EventMediaProvider";

/** Little moving bars that show music is playing. */
export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden className={clsx("dp-eq inline-flex h-4 items-end gap-[2px]", !playing && "paused", className)}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-full w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function Bar({ floating, handle, onCollapse }: { floating?: boolean; handle?: React.ReactNode; onCollapse?: () => void }) {
  const m = useEventMedia();
  if (!m.active || !m.hasMedia) return null;
  const Icon = m.isLive ? Radio : m.isVideo ? Video : Music2;
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 rounded-2xl border border-line bg-surface/95 p-2 pr-1.5 backdrop-blur",
        floating ? "shadow-lift" : "shadow-card",
      )}
    >
      {handle}
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#c2306b] text-white">
        {m.playing && !m.needsTap ? <Equalizer playing className="text-white" /> : <Icon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-tight font-semibold">{m.title}</p>
        <p className="truncate text-[12px] text-muted">
          {m.soundOff ? (
            <span className="font-semibold text-brand">Sound is off · tap the speaker to hear it</span>
          ) : (
            <>
              {m.isLive && <span className="mr-1 font-bold text-chili">LIVE ·</span>}
              {m.active.title}
            </>
          )}
        </p>
      </div>
      {m.isVideo && m.videoHidden && (
        <button onClick={() => m.setVideoHidden(false)} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5" aria-label="Show video">
          <Video size={19} />
        </button>
      )}
      {m.needsTap ? (
        <button onClick={m.toggle} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white">
          <Play size={15} fill="currentColor" /> Tap to play
        </button>
      ) : (
        <button onClick={m.toggle} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition active:scale-95" aria-label={m.playing ? "Pause" : "Play"}>
          {m.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
        </button>
      )}
      <button
        onClick={m.toggleMute}
        className={clsx("grid h-10 w-10 place-items-center rounded-full", m.soundOff ? "animate-pulse bg-brand text-white" : "text-ink-soft hover:bg-ink/5")}
        aria-label={m.muted ? "Unmute" : "Mute"}
      >
        {m.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
      {onCollapse && (
        <button onClick={onCollapse} className="grid h-10 w-9 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Make the player small">
          <Minimize2 size={17} />
        </button>
      )}
      <button onClick={m.stop} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Stop the music">
        <X size={19} />
      </button>
    </div>
  );
}

/** A mini player placed inside a page (hides the floating one while shown). */
export function MiniPlayer({ className }: { className?: string }) {
  const { registerBar, active, hasMedia } = useEventMedia();
  const show = !!active && hasMedia;
  useEffect(() => (show ? registerBar() : undefined), [show, registerBar]);
  if (!show) return null;
  return (
    <div className={className}>
      <Bar />
    </div>
  );
}

/** Shown over other pages while an event is playing. Drag it anywhere, or shrink it to a small bubble. */
export function FloatingMiniPlayer() {
  const m = useEventMedia();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [small, setSmall] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Remember where they put it
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dp-mini-player") ?? "null");
      if (saved) {
        setPos({ x: saved.x ?? 0, y: saved.y ?? 0 });
        setSmall(!!saved.small);
      }
    } catch {}
  }, []);
  const save = (p: { x: number; y: number }, sm: boolean) => {
    try {
      localStorage.setItem("dp-mini-player", JSON.stringify({ ...p, small: sm }));
    } catch {}
  };

  // Keep it on screen
  const clamp = (x: number, y: number) => {
    const el = box.current;
    if (!el) return { x, y };
    const r = el.getBoundingClientRect();
    const baseLeft = r.left - pos.x;
    const baseTop = r.top - pos.y;
    const minX = 8 - baseLeft;
    const maxX = window.innerWidth - 8 - r.width - baseLeft;
    const minY = 8 - baseTop;
    const maxY = window.innerHeight - 8 - r.height - baseTop;
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  };

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setPos(clamp(d.ox + dx, d.oy + dy));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) save(pos, small);
    return !!d?.moved;
  };

  const handle = (
    <span
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      className="-ml-1 grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted active:cursor-grabbing"
      aria-label="Drag to move the player"
      title="Drag to move"
    >
      <GripVertical size={18} />
    </span>
  );

  return (
    <div
      ref={box}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      className={
        small
          ? "fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 lg:right-6 lg:bottom-6"
          : "fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md animate-fade-up lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[400px]"
      }
    >
      {small ? (
        <button
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => {
            if (!up()) {
              setSmall(false);
              setPos({ x: 0, y: 0 });
              save({ x: 0, y: 0 }, false);
            }
          }}
          className="relative grid h-14 w-14 touch-none place-items-center rounded-full bg-gradient-to-br from-brand to-[#c2306b] text-white shadow-lift ring-4 ring-surface"
          aria-label="Open the music player (drag to move)"
        >
          {m.playing && !m.needsTap ? <Equalizer playing className="scale-125 text-white" /> : <Music2 size={22} />}
          {m.soundOff && <span className="absolute -top-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface text-brand"><VolumeX size={12} /></span>}
        </button>
      ) : (
        <Bar
          floating
          handle={handle}
          onCollapse={() => {
            setSmall(true);
            setPos({ x: 0, y: 0 });
            save({ x: 0, y: 0 }, true);
          }}
        />
      )}
    </div>
  );
}

/**
 * The main show in the Room: the video sits here, or a big "now playing"
 * card for music.
 */
export function MediaStage({ big }: { big?: boolean }) {
  const m = useEventMedia();
  if (!m.active || !m.hasMedia) return null;
  if (m.isVideo && !m.videoHidden) {
    return (
      <div className="relative">
        <div ref={m.setStage} className="aspect-video w-full rounded-3xl bg-ink shadow-card" />
        {m.needsTap && (
          <button onClick={m.toggle} className="absolute inset-0 z-[6] grid place-items-center rounded-3xl bg-black/40 text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-ink shadow-lift">
              <Play size={18} fill="currentColor" /> Tap to play
            </span>
          </button>
        )}
      </div>
    );
  }
  if (!big) return null;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-[#2b2148] to-brand p-6 text-white shadow-card">
      <span aria-hidden className="absolute -top-16 -right-10 h-48 w-48 animate-blob rounded-full bg-white/10" />
      <div className="relative flex items-center gap-4">
        <span className={clsx("grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/15", m.playing && "animate-float")}>
          {m.playing && !m.needsTap ? <Equalizer playing className="h-8 scale-150 text-white" /> : <Music2 size={32} />}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-wide text-white/70 uppercase">{m.isLive ? "Live now" : "Now playing"}</p>
          <p className="mt-1 font-display text-[24px] leading-tight font-semibold break-words">{m.title}</p>
          <p className="mt-1 text-[13px] text-white/70">Everyone here hears the same thing</p>
        </div>
      </div>
      <div className="relative mt-5 flex gap-2">
        <button onClick={m.toggle} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-ink transition active:scale-95">
          {m.playing && !m.needsTap ? <><Pause size={16} fill="currentColor" /> Pause</> : <><Play size={16} fill="currentColor" /> {m.needsTap ? "Tap to play" : "Play"}</>}
        </button>
        <button onClick={m.toggleMute} className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label={m.muted ? "Unmute" : "Mute"}>
          {m.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
