"use client";

import { notify } from "@/lib/pushClient";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CallScreen } from "./CallScreen";
import { callCue, startTone, stopTone, unlockAudio } from "./tones";
import { haptic } from "@/lib/haptics";
import { showMediaHelp } from "@/lib/mediaPermission";

export type CallKind = "audio" | "video";
export type CallPeer = { name: string; photo?: string | null };
export type CallStatus = "outgoing" | "incoming" | "connecting" | "connected" | "ended";

export type ActiveCall = {
  id: string;
  matchId: string;
  kind: CallKind;
  role: "caller" | "callee";
  peer: CallPeer;
  status: CallStatus;
  endedReason?: string;
  connectedAt?: number;
};

type Ctx = {
  call: ActiveCall | null;
  startCall: (matchId: string, kind: CallKind, peer: CallPeer) => Promise<void>;
};

const CallContext = createContext<Ctx>({ call: null, startCall: async () => {} });
export const useCall = () => useContext(CallContext);

const RING_SECONDS = 40;

type Signal =
  | { type: "ready" }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "bye" };

async function iceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/ice", { cache: "no-store" });
    if (res.ok) return (await res.json()).iceServers;
  } catch {
    /* use defaults */
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

/** Handles ringing, answering and connecting voice/video calls anywhere in the app. */
export function CallProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const callRef = useRef<ActiveCall | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCChannel | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const local = useRef<MediaStream | null>(null);
  const remote = useRef<MediaStream | null>(null);
  const offering = useRef(false);
  const signalQueue = useRef<Promise<void>>(Promise.resolve());
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipping = useRef(false);

  const update = useCallback((patch: Partial<ActiveCall> | null) => {
    // Any move past ringing silences the ringtone
    if (patch === null || (patch.status && patch.status !== "incoming" && patch.status !== "outgoing")) stopTone();
    setCall((c) => {
      const next = patch === null ? null : c ? { ...c, ...patch } : null;
      callRef.current = next;
      return next;
    });
  }, []);

  const send = useCallback((s: Signal) => {
    channel.current?.send({ type: "broadcast", event: "signal", payload: s }).catch(() => {});
  }, []);

  const clearRestart = () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = null;
  };

  /** Stops everything and shows the "call ended" state briefly. */
  const teardown = useCallback(
    (reason?: string) => {
      stopTone();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      clearRestart();
      pc.current?.close();
      pc.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      remote.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      if (channel.current) supabase.removeChannel(channel.current);
      channel.current = null;
      pendingIce.current = [];
      offering.current = false;
      signalQueue.current = Promise.resolve();
      setMuted(false);
      setCameraOff(false);
      setFacing("user");
      if (callRef.current) {
        if (callRef.current.status !== "ended") callCue("ended");
        update({ status: "ended", endedReason: reason });
        timers.current.push(setTimeout(() => update(null), 1800));
      }
    },
    [supabase, update],
  );

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: kind === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    local.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /** Caller only: sends a fresh offer that restarts ICE (e.g. after switching networks). */
  const restartIce = useCallback(async () => {
    const peer = pc.current;
    if (!peer || callRef.current?.role !== "caller" || peer.signalingState !== "stable") return;
    try {
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      send({ type: "offer", sdp: offer });
    } catch {
      /* the give-up timer will end the call */
    }
  }, [send]);

  const makePeer = useCallback(
    async (stream: MediaStream) => {
      const servers = await iceServers();
      // Call was ended while we were fetching servers
      if (local.current !== stream) return null;
      const peer = new RTCPeerConnection({ iceServers: servers });
      // Tracks go on before any offer/answer so both sides send media
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      peer.onicecandidate = (e) => e.candidate && send({ type: "ice", candidate: e.candidate.toJSON() });
      peer.ontrack = (e) => {
        // Collect their audio + video into one stream; new object so the UI re-renders
        const r = remote.current ?? new MediaStream();
        const tracks = e.streams[0]?.getTracks() ?? [e.track];
        for (const t of [...tracks, e.track]) if (!r.getTrackById(t.id)) r.addTrack(t);
        remote.current = r;
        setRemoteStream(new MediaStream(r.getTracks()));
        e.track.onunmute = () => remote.current && setRemoteStream(new MediaStream(remote.current.getTracks()));
      };
      peer.onconnectionstatechange = () => {
        if (pc.current !== peer) return;
        const st = peer.connectionState;
        if (st === "connected") {
          clearRestart();
          if (callRef.current?.status !== "connected") {
            stopTone();
            callCue("connected");
            update({ status: "connected", connectedAt: Date.now() });
          }
        }
        if (st === "disconnected" || st === "failed") {
          // Try to recover (network switch, weak signal) before giving up
          if (st === "failed") restartIce();
          else if (!restartTimer.current) timers.current.push(setTimeout(() => pc.current === peer && peer.connectionState === "disconnected" && restartIce(), 4000));
          if (!restartTimer.current) {
            restartTimer.current = setTimeout(() => {
              restartTimer.current = null;
              if (pc.current !== peer || peer.connectionState === "connected") return;
              const c = callRef.current;
              if (c) supabase.rpc("update_call", { p_call: c.id, p_status: "ended" });
              send({ type: "bye" });
              teardown("Connection lost");
            }, 20000);
          }
        }
      };
      pc.current = peer;
      return peer;
    },
    [restartIce, send, supabase, teardown, update],
  );

  const flushIce = useCallback(async () => {
    const peer = pc.current;
    if (!peer?.remoteDescription) return;
    for (const c of pendingIce.current.splice(0)) await peer.addIceCandidate(c).catch(() => {});
  }, []);

  /** Joins the private signalling room for this call. */
  const joinRoom = useCallback(
    (callId: string, onSignal: (s: Signal) => void) =>
      new Promise<void>((resolve) => {
        const ch = supabase.channel(`call:${callId}`, { config: { broadcast: { self: false, ack: true } } });
        ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as Signal));
        ch.subscribe((status) => status === "SUBSCRIBED" && resolve());
        channel.current = ch;
      }),
    [supabase],
  );

  const processSignal = useCallback(
    async (s: Signal) => {
      const c = callRef.current;
      if (!c || c.status === "ended") return;
      if (s.type === "bye") {
        teardown("Call ended");
        return;
      }
      const peer = pc.current;
      if (s.type === "ice") {
        // Hold candidates until the other side's description is set
        if (peer?.remoteDescription) await peer.addIceCandidate(s.candidate).catch(() => {});
        else pendingIce.current.push(s.candidate);
        return;
      }
      if (c.role === "caller") {
        if (s.type === "ready") {
          if (!peer && !offering.current && local.current) {
            offering.current = true;
            stopTone();
            update({ status: "connecting" });
            const p = await makePeer(local.current);
            if (!p) return;
            const offer = await p.createOffer();
            await p.setLocalDescription(offer);
            send({ type: "offer", sdp: offer });
          } else if (peer?.signalingState === "have-local-offer" && peer.localDescription) {
            // They're still waiting: our offer (or their answer) got lost, send it again
            send({ type: "offer", sdp: peer.localDescription.toJSON() });
          }
        }
        if (s.type === "answer" && peer?.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(s.sdp);
          await flushIce();
        }
      } else if (s.type === "offer" && peer) {
        if (peer.remoteDescription?.sdp === s.sdp.sdp && peer.localDescription?.type === "answer") {
          // Same offer again: our answer got lost
          send({ type: "answer", sdp: peer.localDescription.toJSON() });
          return;
        }
        if (peer.signalingState !== "stable") return;
        await peer.setRemoteDescription(s.sdp);
        await flushIce();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send({ type: "answer", sdp: answer });
      }
    },
    [flushIce, makePeer, send, teardown, update],
  );

  // Handle signals one at a time so async steps never interleave
  const handleSignal = useCallback(
    (s: Signal) => {
      signalQueue.current = signalQueue.current.then(() => processSignal(s)).catch(() => {});
    },
    [processSignal],
  );

  // ---- Outgoing ----
  const startCall = useCallback(
    async (matchId: string, kind: CallKind, peer: CallPeer) => {
      if (callRef.current) return;
      haptic(15);
      let stream: MediaStream;
      try {
        stream = await getMedia(kind);
      } catch {
        showMediaHelp(kind === "video" ? "video" : "audio");
        return;
      }
      const { data: id, error } = await supabase.rpc("start_call", { p_match: matchId, p_kind: kind });
      if (error || !id) {
        stream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        alert("Couldn't start the call. Please try again.");
        return;
      }
      notify({ kind: "call", callId: id as string });
      const c: ActiveCall = { id: id as string, matchId, kind, role: "caller", peer, status: "outgoing" };
      callRef.current = c;
      setCall(c);
      startTone("ringback");
      await joinRoom(c.id, handleSignal);
      timers.current.push(
        setTimeout(() => {
          if (callRef.current?.id === c.id && callRef.current.status === "outgoing") {
            supabase.rpc("update_call", { p_call: c.id, p_status: "missed" }).then(() => {});
            teardown("No answer");
          }
        }, RING_SECONDS * 1000),
      );
    },
    [getMedia, handleSignal, joinRoom, supabase, teardown],
  );

  // ---- Incoming ----
  const accept = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.role !== "callee" || c.status !== "incoming") return;
    stopTone();
    haptic(15);
    let stream: MediaStream;
    try {
      stream = await getMedia(c.kind);
    } catch {
      showMediaHelp(c.kind === "video" ? "video" : "audio");
      return;
    }
    update({ status: "connecting" });
    const { data } = await supabase.rpc("update_call", { p_call: c.id, p_status: "accepted" });
    if (data !== "accepted") return teardown("Call ended");
    if (!(await makePeer(stream))) return;
    await joinRoom(c.id, handleSignal);
    // Say we're ready until media flows; the caller re-sends its offer if it was lost
    let tries = 0;
    const ping = () => {
      const peer = pc.current;
      if (!peer || callRef.current?.id !== c.id || callRef.current.status === "ended") return;
      if (peer.connectionState === "connected" || tries++ > 20) return;
      send({ type: "ready" });
      timers.current.push(setTimeout(ping, 1500));
    };
    ping();
  }, [getMedia, handleSignal, joinRoom, makePeer, send, supabase, teardown, update]);

  const decline = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    haptic(15);
    await supabase.rpc("update_call", { p_call: c.id, p_status: "declined" });
    teardown("Declined");
  }, [supabase, teardown]);

  const hangUp = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    haptic(15);
    send({ type: "bye" });
    await supabase.rpc("update_call", { p_call: c.id, p_status: "ended" });
    teardown(c.status === "outgoing" ? "Cancelled" : "Call ended");
  }, [send, supabase, teardown]);

  // Listen for calls to me, and for the other side declining/ending
  // Let an incoming call ring out loud even if you haven't touched the page since it loaded
  useEffect(() => unlockAudio(), []);

  useEffect(() => {
    const ch = supabase
      .channel(`calls-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, async (p) => {
        const row = p.new as { id: string; match_id: string; caller_id: string; kind: CallKind; status: string; created_at: string };
        if (row.status !== "ringing" || callRef.current) return;
        if (Date.now() - new Date(row.created_at).getTime() > RING_SECONDS * 1000) return;
        // Their name and photo (their real face only if you've both unmasked)
        const { data: who } = (await supabase.rpc("chat_peer", { p_match: row.match_id })) as { data: { name?: string; photo?: string | null } | null };
        const c: ActiveCall = {
          id: row.id,
          matchId: row.match_id,
          kind: row.kind,
          role: "callee",
          peer: { name: who?.name ?? "Your connection", photo: who?.photo ?? null },
          status: "incoming",
        };
        callRef.current = c;
        setCall(c);
        startTone("ring");
        timers.current.push(
          setTimeout(() => {
            if (callRef.current?.id === c.id && callRef.current.status === "incoming") teardown("Missed call");
          }, RING_SECONDS * 1000),
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `caller_id=eq.${userId}` }, (p) => {
        const row = p.new as { id: string; status: string };
        if (callRef.current?.id !== row.id) return;
        // They picked up: stop the ringback straight away, even before media connects
        if (row.status === "accepted" && callRef.current.status === "outgoing") update({ status: "connecting" });
        if (row.status === "declined") teardown("Declined");
        if (row.status === "ended" || row.status === "missed") teardown("Call ended");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, (p) => {
        const row = p.new as { id: string; status: string };
        if (callRef.current?.id !== row.id) return;
        // Answered on another tab or device: stop ringing here
        if (row.status === "accepted" && callRef.current.status === "incoming") return teardown("Answered on another device");
        if (row.status === "cancelled" || row.status === "ended" || row.status === "missed") teardown("Call ended");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, teardown, update, userId]);

  // Hang up properly if the page is closed mid-call
  useEffect(() => {
    const bye = () => {
      const c = callRef.current;
      if (c && c.status !== "ended") {
        send({ type: "bye" });
        supabase.rpc("update_call", { p_call: c.id, p_status: c.role === "callee" && c.status === "incoming" ? "declined" : "ended" }).then(() => {});
      }
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [send, supabase]);

  function toggleMute() {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }
  function toggleCamera() {
    const next = !cameraOff;
    local.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }
  async function flipCamera() {
    const stream = local.current;
    if (!stream || flipping.current) return;
    flipping.current = true;
    const nextFacing: "user" | "environment" = facing === "user" ? "environment" : "user";
    const old = stream.getVideoTracks()[0];
    const open = async (f: "user" | "environment") =>
      (await navigator.mediaDevices.getUserMedia({ video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 720 } } })).getVideoTracks()[0];
    let track: MediaStreamTrack | undefined;
    let used = nextFacing;
    try {
      track = await open(nextFacing);
    } catch {
      // Many phones can't open two cameras at once: release the current one and retry
      old?.stop();
      track = await open(nextFacing).catch(() => {
        used = facing;
        return open(facing).catch(() => undefined);
      });
    }
    if (track && local.current === stream) {
      track.enabled = !cameraOff;
      const peer = pc.current;
      const sender =
        peer?.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender ??
        peer?.getSenders().find((x) => x.track?.kind === "video");
      await sender?.replaceTrack(track).catch(() => {});
      if (old) {
        old.stop();
        stream.removeTrack(old);
      }
      stream.addTrack(track);
      setLocalStream(new MediaStream(stream.getTracks()));
      setFacing(used);
    } else {
      track?.stop();
    }
    flipping.current = false;
  }

  return (
    <CallContext.Provider value={{ call, startCall }}>
      {children}
      {call && (
        <CallScreen
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          muted={muted}
          cameraOff={cameraOff}
          mirrored={facing === "user"}
          onAccept={accept}
          onDecline={decline}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onFlip={flipCamera}
        />
      )}
    </CallContext.Provider>
  );
}

type RTCChannel = RealtimeChannel;
