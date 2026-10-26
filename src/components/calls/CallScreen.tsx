"use client";

import { Photo } from "@/components/ui/Photo";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, SwitchCamera, Video, VideoOff, Volume1, Volume2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { ActiveCall } from "./CallProvider";

export function CallScreen({
  call,
  localStream,
  remoteStream,
  muted,
  cameraOff,
  mirrored,
  onAccept,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onFlip,
}: {
  call: ActiveCall;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  mirrored: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlip: () => void;
}) {
  // Video/audio elements mount and unmount as the call changes state, so the
  // stream is attached whenever either the element or the stream changes.
  // Their sound plays through <audio>; both videos stay muted so autoplay is allowed.
  const remoteVideo = useMediaStream<HTMLVideoElement>(remoteStream, true);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const remoteAudio = useMediaStream<HTMLAudioElement>(remoteStream, false, setAudioEl);
  const localVideo = useMediaStream<HTMLVideoElement>(localStream, true);
  const root = useRef<HTMLDivElement>(null);
  // Shrink to a small bubble to chat or play while you talk
  const [mini, setMini] = useState(false);
  // Loudspeaker (video calls start on it)
  const [speaker, setSpeaker] = useState(call.kind === "video");
  const speakerNote = useSpeaker(audioEl, remoteStream, speaker);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragFrom = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const video = call.kind === "video";
  const live = call.status === "connected";
  const showRemoteVideo = video && live && !!remoteStream?.getVideoTracks().length;

  // Phones may block playback until a tap: retry on any tap on the call screen
  const resume = () => root.current?.querySelectorAll<HTMLMediaElement>("video, audio").forEach((m) => m.paused && m.srcObject && m.play().catch(() => {}));
  const secs = call.connectedAt ? Math.floor((now - call.connectedAt) / 1000) : 0;
  const statusText =
    call.status === "incoming"
      ? `Incoming ${video ? "video" : "voice"} call…`
      : call.status === "outgoing"
        ? "Ringing…"
        : call.status === "connecting"
          ? "Connecting…"
          : call.status === "ended"
            ? call.endedReason ?? "Call ended"
            : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (!mounted) return null;
  // Only once the call is under way: ringing and incoming calls stay full screen
  const canMini = call.status === "connected" || call.status === "connecting" || call.status === "outgoing";
  if (mini && canMini) {
    const w = video && showRemoteVideo ? 112 : 168;
    return createPortal(
      <div
        ref={root}
        className="fixed z-[80] animate-pop touch-none select-none"
        style={{
          left: pos ? pos.x : undefined,
          right: pos ? undefined : 12,
          top: pos ? pos.y : "calc(max(12px, env(safe-area-inset-top)) + 56px)",
          width: w,
        }}
        onPointerDown={(e) => {
          resume();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          dragFrom.current = { x: e.clientX, y: e.clientY, px: r.left, py: r.top, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragFrom.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 6) return;
          d.moved = true;
          setPos({
            x: Math.max(6, Math.min(window.innerWidth - w - 6, d.px + dx)),
            y: Math.max(6, Math.min(window.innerHeight - 120, d.py + dy)),
          });
        }}
        onPointerUp={(e) => {
          const d = dragFrom.current;
          dragFrom.current = null;
          // A tap (not a drag) on the bubble opens the call again
          if (d && !d.moved && !(e.target as HTMLElement).closest("button")) setMini(false);
        }}
        role="dialog"
        aria-label={`Call with ${call.peer.name}`}
      >
        <div className="overflow-hidden rounded-[22px] bg-ink text-white shadow-[0_18px_40px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
          {showRemoteVideo ? (
            <video ref={remoteVideo} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="flex items-center gap-2.5 px-3 pt-3">
              <span className="relative">
                <Avatar src={call.peer.photo} name={call.peer.name} size={40} />
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-ink" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{call.peer.name}</span>
                <span className="block text-[12px] text-white/70 tabular-nums">{statusText}</span>
              </span>
            </div>
          )}
          <audio ref={remoteAudio} autoPlay playsInline />
          <div className="flex items-center justify-between gap-1 p-2">
            <MiniButton label={muted ? "Unmute" : "Mute"} on={muted} onClick={onToggleMute}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </MiniButton>
            <MiniButton label="Open call" onClick={() => setMini(false)}>
              <Maximize2 size={16} />
            </MiniButton>
            <MiniButton label="End call" danger onClick={onHangUp}>
              <PhoneOff size={16} />
            </MiniButton>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div ref={root} onPointerDown={resume} className="fixed inset-0 z-[80] flex animate-fade-in flex-col overflow-hidden bg-ink text-white" role="dialog" aria-modal="true" aria-label="Call">
      {/* Background: their video, or a soft blurred photo */}
      {showRemoteVideo ? (
        <video ref={remoteVideo} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          {call.peer.photo && (
            <Photo src={call.peer.photo} small={false} fallback={null} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-brand/40 via-ink/60 to-ink" />
        </>
      )}
      <audio ref={remoteAudio} autoPlay playsInline />

      {canMini && (
        <button
          type="button"
          onClick={() => setMini(true)}
          className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-30 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[13px] font-semibold backdrop-blur-md"
          aria-label="Minimise the call"
        >
          <Minimize2 size={16} /> Chat while you talk
        </button>
      )}

      {/* Who and status */}
      <div className={clsx("relative z-10 flex flex-col items-center px-6 text-center", showRemoteVideo ? "pt-[max(1.25rem,env(safe-area-inset-top))]" : "pt-[18vh]")}>
        {!showRemoteVideo && (
          <div className="relative mb-6">
            {(call.status === "incoming" || call.status === "outgoing") && (
              <>
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/25" />
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/20 [animation-delay:1.1s]" />
              </>
            )}
            <Avatar src={call.peer.photo} name={call.peer.name} size={120} className="relative ring-4 ring-white/20" />
          </div>
        )}
        <p className={clsx("font-semibold", showRemoteVideo ? "text-[18px] drop-shadow" : "text-[28px]")}>{call.peer.name}</p>
        <p className={clsx("mt-1 tabular-nums", showRemoteVideo ? "text-[13px] text-white/85 drop-shadow" : "text-[16px] text-white/75")}>
          {statusText}
        </p>
      </div>

      {/* My camera, small in the corner */}
      {video && localStream && call.status !== "incoming" && call.status !== "ended" && (
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/30 bg-black shadow-lift">
          {cameraOff ? (
            <div className="grid h-full place-items-center text-white/70">
              <VideoOff size={22} />
            </div>
          ) : (
            <video ref={localVideo} autoPlay playsInline muted className={clsx("h-full w-full object-cover", mirrored && "-scale-x-100")} />
          )}
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 mt-auto px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {call.status === "incoming" ? (
          <div className="flex items-center justify-around">
            <RoundButton label="Decline" tone="bg-chili" onClick={onDecline}>
              <PhoneOff size={28} />
            </RoundButton>
            <RoundButton label="Accept" tone="bg-mint animate-pop" onClick={onAccept}>
              {video ? <Video size={28} /> : <Phone size={28} />}
            </RoundButton>
          </div>
        ) : call.status === "ended" ? null : (
          <>
          {speakerNote && speaker && <p className="mb-2 text-center text-[12px] text-white/70">{speakerNote}</p>}
          <div className="flex items-center justify-center gap-4 rounded-[32px] bg-black/30 px-4 py-4 backdrop-blur-md">
            <RoundButton small label={muted ? "Unmute" : "Mute"} tone={muted ? "bg-white text-ink!" : "bg-white/15"} onClick={onToggleMute}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </RoundButton>
            <RoundButton small label="Speaker" tone={speaker ? "bg-white text-ink!" : "bg-white/15"} onClick={() => setSpeaker((v) => !v)}>
              {speaker ? <Volume2 size={22} /> : <Volume1 size={22} />}
            </RoundButton>
            {video && (
              <RoundButton small label={cameraOff ? "Camera on" : "Camera off"} tone={cameraOff ? "bg-white text-ink!" : "bg-white/15"} onClick={onToggleCamera}>
                {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
              </RoundButton>
            )}
            {video && (
              <RoundButton small label="Flip" tone="bg-white/15" onClick={onFlip}>
                <SwitchCamera size={22} />
              </RoundButton>
            )}
            <RoundButton small label="End" tone="bg-chili" onClick={onHangUp}>
              <PhoneOff size={22} />
            </RoundButton>
          </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Callback ref that keeps a media element playing the given stream. */
function useMediaStream<T extends HTMLMediaElement>(stream: MediaStream | null, muted: boolean, onEl?: (el: T | null) => void) {
  const [el, setElState] = useState<T | null>(null);
  const setEl = (x: T | null) => {
    setElState(x);
    onEl?.(x);
  };
  useEffect(() => {
    if (!el) return;
    el.muted = muted;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) el.play().catch(() => {});
  }, [el, stream, muted]);
  return setEl;
}

function RoundButton({
  children,
  label,
  tone,
  onClick,
  small,
}: {
  children: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 transition active:scale-90" aria-label={label}>
      <span className={clsx("grid place-items-center rounded-full text-white shadow-lift", small ? "h-14 w-14" : "h-[72px] w-[72px]", tone)}>{children}</span>
      <span className="text-[12px] font-medium text-white/85">{label}</span>
    </button>
  );
}

function MiniButton({ children, label, onClick, on, danger }: { children: React.ReactNode; label: string; onClick: () => void; on?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx("grid h-9 flex-1 place-items-center rounded-full transition active:scale-90", danger ? "bg-chili" : on ? "bg-white text-ink" : "bg-white/15")}
    >
      {children}
    </button>
  );
}

/**
 * Loudspeaker. Phones that let a page pick where sound goes (Android Chrome) switch to
 * the speaker. Where they don't (iPhones), the call is played louder instead.
 * Returns a short note when only the louder mode is available.
 */
function useSpeaker(el: HTMLAudioElement | null, stream: MediaStream | null, on: boolean) {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!el || !stream) return;
    let ctx: AudioContext | null = null;
    let cancelled = false;
    (async () => {
      const sink = (el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId;
      if (sink && navigator.mediaDevices?.enumerateDevices) {
        try {
          const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
          const pick = outs.find((d) => (on ? /speaker/i : /earpiece|receiver|handset|phone/i).test(d.label));
          if (pick || !on) {
            await sink.call(el, pick?.deviceId ?? "");
            el.muted = false;
            el.volume = 1;
            if (!cancelled) setNote(null);
            return;
          }
        } catch {
          /* fall back to louder */
        }
      }
      // Louder: play the call through Web Audio with a boost, instead of the plain player
      if (on) {
        try {
          ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const src = ctx.createMediaStreamSource(stream);
          const gain = ctx.createGain();
          gain.gain.value = 2.2;
          src.connect(gain).connect(ctx.destination);
          if (ctx.state === "suspended") await ctx.resume().catch(() => {});
          el.muted = true;
          if (!cancelled) setNote("Louder sound on. Use your phone's volume buttons for more.");
        } catch {
          el.muted = false;
        }
      } else {
        el.muted = false;
        if (!cancelled) setNote(null);
      }
    })();
    return () => {
      cancelled = true;
      if (ctx) {
        void ctx.close().catch(() => {});
        el.muted = false;
      }
    };
  }, [el, stream, on]);
  return note;
}
