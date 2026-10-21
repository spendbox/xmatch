"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from "lucide-react";
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
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
    if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
  }, [remoteStream]);
  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const video = call.kind === "video";
  const live = call.status === "connected";
  const showRemoteVideo = video && live && remoteStream;
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
  return createPortal(
    <div className="fixed inset-0 z-[80] flex animate-fade-in flex-col overflow-hidden bg-ink text-white" role="dialog" aria-modal="true" aria-label="Call">
      {/* Background: their video, or a soft blurred photo */}
      {showRemoteVideo ? (
        <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          {call.peer.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={call.peer.photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-brand/40 via-ink/60 to-ink" />
        </>
      )}
      <audio ref={remoteAudio} autoPlay />

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
          <div className="flex items-center justify-center gap-5 rounded-[32px] bg-black/30 px-5 py-4 backdrop-blur-md">
            <RoundButton small label={muted ? "Unmute" : "Mute"} tone={muted ? "bg-white text-ink!" : "bg-white/15"} onClick={onToggleMute}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
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
        )}
      </div>
    </div>,
    document.body,
  );
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
