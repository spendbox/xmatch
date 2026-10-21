"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CallScreen } from "./CallScreen";
import { startTone, stopTone } from "./tones";

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
  const offering = useRef(false);

  const update = useCallback((patch: Partial<ActiveCall> | null) => {
    setCall((c) => {
      const next = patch === null ? null : c ? { ...c, ...patch } : null;
      callRef.current = next;
      return next;
    });
  }, []);

  const send = useCallback((s: Signal) => {
    channel.current?.send({ type: "broadcast", event: "signal", payload: s });
  }, []);

  /** Stops everything and shows the "call ended" state briefly. */
  const teardown = useCallback(
    (reason?: string) => {
      stopTone();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      pc.current?.close();
      pc.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      if (channel.current) supabase.removeChannel(channel.current);
      channel.current = null;
      pendingIce.current = [];
      offering.current = false;
      setMuted(false);
      setCameraOff(false);
      if (callRef.current) {
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

  const makePeer = useCallback(
    async (stream: MediaStream) => {
      const peer = new RTCPeerConnection({ iceServers: await iceServers() });
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      peer.onicecandidate = (e) => e.candidate && send({ type: "ice", candidate: e.candidate.toJSON() });
      peer.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      peer.onconnectionstatechange = () => {
        const st = peer.connectionState;
        if (st === "connected" && callRef.current?.status !== "connected") {
          stopTone();
          update({ status: "connected", connectedAt: Date.now() });
        }
        if (st === "failed") {
          const c = callRef.current;
          if (c) supabase.rpc("update_call", { p_call: c.id, p_status: "ended" });
          teardown("Connection lost");
        }
      };
      pc.current = peer;
      return peer;
    },
    [send, supabase, teardown, update],
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
        const ch = supabase.channel(`call:${callId}`, { config: { broadcast: { self: false } } });
        ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as Signal));
        ch.subscribe((status) => status === "SUBSCRIBED" && resolve());
        channel.current = ch;
      }),
    [supabase],
  );

  const handleSignal = useCallback(
    async (s: Signal) => {
      const c = callRef.current;
      if (!c) return;
      if (s.type === "bye") {
        teardown(c.status === "connected" ? "Call ended" : "Call ended");
        return;
      }
      if (s.type === "ice") {
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.candidate).catch(() => {});
        else pendingIce.current.push(s.candidate);
        return;
      }
      if (c.role === "caller") {
        if (s.type === "ready" && !pc.current && !offering.current && local.current) {
          offering.current = true;
          stopTone();
          update({ status: "connecting" });
          const peer = await makePeer(local.current);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          send({ type: "offer", sdp: offer });
        }
        if (s.type === "answer" && pc.current && !pc.current.remoteDescription) {
          await pc.current.setRemoteDescription(s.sdp);
          await flushIce();
        }
      } else if (s.type === "offer" && pc.current && !pc.current.remoteDescription) {
        await pc.current.setRemoteDescription(s.sdp);
        await flushIce();
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        send({ type: "answer", sdp: answer });
      }
    },
    [flushIce, makePeer, send, teardown, update],
  );

  // ---- Outgoing ----
  const startCall = useCallback(
    async (matchId: string, kind: CallKind, peer: CallPeer) => {
      if (callRef.current) return;
      let stream: MediaStream;
      try {
        stream = await getMedia(kind);
      } catch {
        alert(kind === "video" ? "Allow camera and microphone access to make video calls." : "Allow microphone access to make calls.");
        return;
      }
      const { data: id, error } = await supabase.rpc("start_call", { p_match: matchId, p_kind: kind });
      if (error || !id) {
        stream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        alert("Couldn't start the call. Please try again.");
        return;
      }
      const c: ActiveCall = { id: id as string, matchId, kind, role: "caller", peer, status: "outgoing" };
      callRef.current = c;
      setCall(c);
      startTone("ringback");
      await joinRoom(c.id, handleSignal);
      timers.current.push(
        setTimeout(() => {
          if (callRef.current?.id === c.id && callRef.current.status === "outgoing") {
            supabase.rpc("update_call", { p_call: c.id, p_status: "missed" });
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
    if (!c || c.role !== "callee") return;
    stopTone();
    let stream: MediaStream;
    try {
      stream = await getMedia(c.kind);
    } catch {
      alert("Allow microphone (and camera for video) to answer.");
      return;
    }
    update({ status: "connecting" });
    const { data } = await supabase.rpc("update_call", { p_call: c.id, p_status: "accepted" });
    if (data !== "accepted") return teardown("Call ended");
    await makePeer(stream);
    await joinRoom(c.id, handleSignal);
    // Say we're ready until the caller sends the offer
    const ping = () => {
      if (pc.current && !pc.current.remoteDescription && callRef.current?.id === c.id) {
        send({ type: "ready" });
        timers.current.push(setTimeout(ping, 1500));
      }
    };
    ping();
  }, [getMedia, handleSignal, joinRoom, makePeer, send, supabase, teardown, update]);

  const decline = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    await supabase.rpc("update_call", { p_call: c.id, p_status: "declined" });
    teardown("Declined");
  }, [supabase, teardown]);

  const hangUp = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    send({ type: "bye" });
    await supabase.rpc("update_call", { p_call: c.id, p_status: "ended" });
    teardown(c.status === "outgoing" ? "Cancelled" : "Call ended");
  }, [send, supabase, teardown]);

  // Listen for calls to me, and for the other side declining/ending
  useEffect(() => {
    const ch = supabase
      .channel(`calls-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, async (p) => {
        const row = p.new as { id: string; match_id: string; caller_id: string; kind: CallKind; status: string; created_at: string };
        if (row.status !== "ringing" || callRef.current) return;
        if (Date.now() - new Date(row.created_at).getTime() > RING_SECONDS * 1000) return;
        const { data: who } = await supabase.from("profiles").select("display_name, photos").eq("id", row.caller_id).maybeSingle();
        const c: ActiveCall = {
          id: row.id,
          matchId: row.match_id,
          kind: row.kind,
          role: "callee",
          peer: { name: who?.display_name ?? "Your match", photo: who?.photos?.[0] },
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
        if (row.status === "declined") teardown("Declined");
        if (row.status === "ended" || row.status === "missed") teardown("Call ended");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, (p) => {
        const row = p.new as { id: string; status: string };
        if (callRef.current?.id !== row.id) return;
        if (row.status === "cancelled" || row.status === "ended" || row.status === "missed") teardown("Call ended");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, teardown, userId]);

  // Hang up properly if the page is closed mid-call
  useEffect(() => {
    const bye = () => {
      const c = callRef.current;
      if (c && c.status !== "ended") {
        send({ type: "bye" });
        supabase.rpc("update_call", { p_call: c.id, p_status: c.role === "callee" && c.status === "incoming" ? "declined" : "ended" });
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
    const nextFacing = facing === "user" ? "environment" : "user";
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing } });
      const track = s.getVideoTracks()[0];
      const sender = pc.current?.getSenders().find((x) => x.track?.kind === "video");
      await sender?.replaceTrack(track);
      local.current?.getVideoTracks().forEach((t) => {
        t.stop();
        local.current?.removeTrack(t);
      });
      local.current?.addTrack(track);
      setLocalStream(new MediaStream(local.current?.getTracks() ?? []));
      setFacing(nextFacing);
    } catch {
      /* phone has one camera */
    }
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
