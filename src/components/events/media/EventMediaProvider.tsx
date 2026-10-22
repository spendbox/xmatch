"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { GripHorizontal, MessageCircle, VideoOff, X } from "lucide-react";
import type HlsType from "hls.js";
import { createClient } from "@/lib/supabase/client";
import type { DashpadEvent, EventMedia } from "@/lib/events";
import { playlistPosition, streamType, youtubeId, type StreamType } from "@/lib/eventSpace";
import { FloatingMiniPlayer } from "./MiniPlayer";

/** What the player needs to know about the event that's on. */
export type ActiveEvent = Pick<DashpadEvent, "id" | "title" | "kind" | "stream_url" | "media" | "starts_at" | "ends_at" | "settings"> & { cover_url?: string | null };

type Toast = { id: number; text: string; href?: string };

export type EventMediaCtx = {
  active: ActiveEvent | null;
  /** Call straight from a tap (phones only allow sound after one). */
  start: (e: ActiveEvent, skewMs?: number, opts?: { auto?: boolean }) => void;
  /** Stop the music/video but stay at the event */
  stop: () => void;
  /** Leave the event entirely (it ended) */
  leave: () => void;
  /** The event has music or video but it's switched off */
  mediaOff: boolean;
  toggle: () => void;
  toggleMute: () => void;
  playing: boolean;
  muted: boolean;
  /** The browser blocked playback; a tap on "Tap to play" fixes it. */
  needsTap: boolean;
  /** Started without a tap (coming back to the event), so it's playing silently until they unmute */
  soundOff: boolean;
  hasMedia: boolean;
  /** Something to look at (video or a YouTube stream), not just sound. */
  isVideo: boolean;
  isLive: boolean;
  title: string;
  /** Where the big video goes (the Room). Use as a ref. */
  setStage: (el: HTMLElement | null) => void;
  /** A page showing its own mini player; hides the floating one. Returns a cleanup. */
  registerBar: () => () => void;
  videoHidden: boolean;
  setVideoHidden: (v: boolean) => void;
  /** Unread private messages per event chat while you're at the event */
  unread: Record<string, number>;
  unreadTotal: number;
  clearUnread: (chatId: string) => void;
};

const noop = () => {};
const Ctx = createContext<EventMediaCtx>({
  active: null,
  start: noop,
  stop: noop,
  leave: noop,
  mediaOff: false,
  soundOff: false,
  toggle: noop,
  toggleMute: noop,
  playing: false,
  muted: false,
  needsTap: false,
  hasMedia: false,
  isVideo: false,
  isLive: false,
  title: "",
  setStage: noop,
  registerBar: () => noop,
  videoHidden: false,
  setVideoHidden: noop,
  unread: {},
  unreadTotal: 0,
  clearUnread: noop,
});

export const useEventMedia = () => useContext(Ctx);

const CHAT_PATH = /^\/events\/([^/]+)\/chat\/([^/]+)/;
const OTHER_FULL_SCREEN = /^\/masquerade\/[^/]+|^\/matches\/(?!people)[^/]+|^\/feed\/chat\//;

export function EventMediaProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const path = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState<ActiveEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [index, setIndex] = useState(0);
  const [hasPicture, setHasPicture] = useState(false);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const [bars, setBars] = useState(0);
  const [videoHidden, setVideoHidden] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [mediaOff, setMediaOff] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const [ytMuted, setYtMuted] = useState(false);
  const [hint, setHint] = useState(false);
  const off = useRef(false);
  const userPaused = useRef(false);
  const titleRef = useRef("");

  const video = useRef<HTMLVideoElement>(null);
  const yt = useRef<HTMLIFrameElement>(null);
  const hls = useRef<HlsType | null>(null);
  const ev = useRef<ActiveEvent | null>(null);
  const skew = useRef(0);
  const idx = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const kind: StreamType | "playlist" | null = !active ? null : active.stream_url ? streamType(active.stream_url) : active.media.length ? "playlist" : null;
  const isYouTube = kind === "youtube";
  const hasMedia = !!kind && !mediaOff;
  const showVideo = active?.settings?.show_video !== false;
  const isVideo = hasMedia && showVideo && (isYouTube || hasPicture);
  const now = () => Date.now() + skew.current;

  /* ---------- playback ---------- */

  const tryPlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    const p = v.play();
    if (p)
      p.then(() => setNeedsTap(false)).catch((err: Error) => {
        if (err?.name !== "NotAllowedError") return;
        // No tap yet (e.g. coming back to the event): play silently in step with everyone; one tap turns the sound on
        v.muted = true;
        setMuted(true);
        v.play()
          .then(() => {
            setNeedsTap(false);
            setSoundOff(true);
          })
          .catch(() => setNeedsTap(true));
      });
  }, []);

  const ytCommand = useCallback((func: string) => {
    yt.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }, []);

  const loadItem = useCallback(
    (i: number, offset: number) => {
      const e = ev.current;
      const v = video.current;
      if (!e || !v || !e.media[i]) return;
      idx.current = i;
      setIndex(i);
      setHasPicture(e.media[i].kind === "video");
      pendingSeek.current = offset > 1 ? offset : null;
      v.src = e.media[i].url;
      tryPlay();
    },
    [tryPlay],
  );

  const teardown = useCallback(() => {
    hls.current?.destroy();
    hls.current = null;
    const v = video.current;
    if (v) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
  }, []);

  const start = useCallback(
    (e: ActiveEvent, skewMs = 0, opts?: { auto?: boolean }) => {
      const v = video.current;
      skew.current = skewMs;
      try {
        // Remember they joined, so coming back to the event picks the music up again
        localStorage.setItem("dp-event-joined", e.id);
      } catch {}
      if (ev.current?.id === e.id && !off.current) {
        // Already on: just make sure it's playing
        if (v && v.paused && !(e.stream_url && youtubeId(e.stream_url))) tryPlay();
        return;
      }
      if (ev.current?.id !== e.id) {
        ev.current = e;
        setActive(e);
        setUnread({});
        setVideoHidden(false);
        setDrag({ x: 0, y: 0 });
      }
      teardown();
      off.current = false;
      setMediaOff(false);
      setNeedsTap(false);
      setSoundOff(false);
      if (!v) return;
      v.muted = false;
      setMuted(false);
      // YouTube can only start by itself muted; the first tap anywhere turns the sound back on
      const ytAuto = !!opts?.auto && !!e.stream_url && streamType(e.stream_url) === "youtube";
      setYtMuted(ytAuto);
      if (ytAuto) {
        setMuted(true);
        setSoundOff(true);
      }
      if (e.stream_url) {
        const type = streamType(e.stream_url);
        if (type === "youtube") {
          setPlaying(true);
          return;
        }
        setHasPicture(type !== "audio");
        if (type === "hls" && !v.canPlayType("application/vnd.apple.mpegurl")) {
          // Unlock sound now, inside the tap, then hand the stream to hls.js
          v.play().catch(() => {});
          import("hls.js").then(({ default: Hls }) => {
            if (ev.current?.id !== e.id || !video.current) return;
            if (!Hls.isSupported()) {
              video.current.src = e.stream_url!;
              return tryPlay();
            }
            const h = new Hls({ lowLatencyMode: true });
            hls.current = h;
            h.loadSource(e.stream_url!);
            h.attachMedia(video.current);
            h.on(Hls.Events.MANIFEST_PARSED, () => tryPlay());
          });
          return;
        }
        v.src = e.stream_url;
        tryPlay();
        return;
      }
      const pos = playlistPosition(e.media, e.starts_at, Date.now() + skewMs);
      if (pos) loadItem(pos.index, pos.offset);
    },
    [teardown, tryPlay, loadItem],
  );

  const stop = useCallback(() => {
    teardown();
    off.current = true;
    setMediaOff(true);
    setPlaying(false);
    setNeedsTap(false);
  }, [teardown]);

  const leave = useCallback(() => {
    teardown();
    ev.current = null;
    off.current = false;
    setActive(null);
    setMediaOff(false);
    setPlaying(false);
    setNeedsTap(false);
    setUnread({});
  }, [teardown]);

  const toggle = useCallback(() => {
    if (isYouTube) {
      ytCommand(playing ? "pauseVideo" : "playVideo");
      setPlaying(!playing);
      return;
    }
    const v = video.current;
    if (!v) return;
    userPaused.current = !(v.paused || needsTap);
    if (v.paused || needsTap) {
      // Rejoin the shared clock when coming back from a pause
      const e = ev.current;
      if (e && !e.stream_url) {
        const pos = playlistPosition(e.media, e.starts_at, now());
        if (pos && pos.index !== idx.current) return loadItem(pos.index, pos.offset);
        if (pos && Number.isFinite(v.duration) && pos.offset < v.duration) v.currentTime = pos.offset;
      }
      tryPlay();
    } else v.pause();
  }, [isYouTube, playing, needsTap, ytCommand, tryPlay, loadItem]);

  const toggleMute = useCallback(() => {
    // Go by what's actually playing, so one tap always flips it
    const next = isYouTube ? !muted : !(video.current?.muted ?? muted);
    setMuted(next);
    if (!next) setSoundOff(false);
    if (isYouTube) ytCommand(next ? "mute" : "unMute");
    else if (video.current) video.current.muted = next;
  }, [muted, isYouTube, ytCommand]);

  // Media element events
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onPlay = () => {
      setPlaying(true);
      setNeedsTap(false);
    };
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (!ev.current || off.current) return;
      setHasPicture(v.videoWidth > 0);
      const e0 = ev.current;
      if (e0.stream_url && Number.isFinite(v.duration) && v.duration > 1) {
        // A video or audio file link: everyone is at the same point, looping
        const elapsed = (now() - new Date(e0.starts_at).getTime()) / 1000;
        if (elapsed > 1) v.currentTime = elapsed % v.duration;
      }
      const seek = pendingSeek.current;
      pendingSeek.current = null;
      if (seek != null && !ev.current.stream_url) {
        if (Number.isFinite(v.duration) && seek >= v.duration - 1) {
          // The real file is shorter than listed: move on
          const n = ev.current.media.length;
          loadItem((idx.current + 1) % n, 0);
        } else v.currentTime = seek;
      }
    };
    const onEnded = () => {
      const e = ev.current;
      if (!e || off.current) return;
      if (e.stream_url) {
        // A file link loops; a live stream that stops has ended
        if (Number.isFinite(v.duration) && v.duration > 1) {
          v.currentTime = 0;
          tryPlay();
        }
        return;
      }
      const n = e.media.length;
      const pos = playlistPosition(e.media, e.starts_at, now());
      if (!pos || pos.index === idx.current || n === 1) loadItem((idx.current + 1) % n, 0);
      else loadItem(pos.index, pos.offset);
    };
    const onError = () => {
      const e = ev.current;
      if (!e || off.current || e.stream_url || e.media.length < 2) return;
      // Skip a file that won't play
      setTimeout(() => ev.current === e && loadItem((idx.current + 1) % e.media.length, 0), 1500);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
    };
  }, [loadItem, tryPlay]);

  // Stay in step with everyone else, and stop when the event ends
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const e = ev.current;
      if (!e) return;
      if (now() >= new Date(e.ends_at).getTime()) return leave();
      const v = video.current;
      if (!v || v.paused) return;
      if (e.stream_url) {
        if (Number.isFinite(v.duration) && v.duration > 1) {
          const want = ((now() - new Date(e.starts_at).getTime()) / 1000) % v.duration;
          if (Math.abs(v.currentTime - want) > 5) v.currentTime = want;
        }
        return;
      }
      const pos = playlistPosition(e.media, e.starts_at, now());
      if (pos && pos.index === idx.current && Math.abs(v.currentTime - pos.offset) > 5 && Number.isFinite(v.duration) && pos.offset < v.duration) {
        v.currentTime = pos.offset;
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [active, leave]);

  // Some events keep private chats quiet
  const chatMatch = path.match(CHAT_PATH);
  const quietHere = !!active && !!chatMatch && chatMatch[1] === active.id && active.settings?.media_under_chats === false;
  const resumeAfterChat = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (quietHere) {
      if (isYouTube) {
        ytCommand("pauseVideo");
        resumeAfterChat.current = true;
      } else if (video.current && !video.current.paused) {
        video.current.pause();
        resumeAfterChat.current = true;
      }
    } else if (resumeAfterChat.current) {
      resumeAfterChat.current = false;
      if (isYouTube) ytCommand("playVideo");
      else tryPlay();
    }
  }, [quietHere, active, isYouTube, ytCommand, tryPlay]);

  // Started silently (no tap yet): the first tap or key press anywhere turns the sound on
  useEffect(() => {
    if (!soundOff) return;
    const on = (ev: Event) => {
      // A tap on the speaker button is handled by the button itself
      if ((ev.target as Element | null)?.closest?.("[data-sound-toggle]")) return;
      document.removeEventListener("pointerdown", on, { capture: true });
      document.removeEventListener("keydown", on, { capture: true });
      setSoundOff(false);
      setMuted(false);
      if (isYouTube) {
        ytCommand("unMute");
        ytCommand("playVideo");
      } else if (video.current) {
        video.current.muted = false;
        if (video.current.paused) tryPlay();
      }
    };
    document.addEventListener("pointerdown", on, { capture: true });
    document.addEventListener("keydown", on, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", on, { capture: true });
      document.removeEventListener("keydown", on, { capture: true });
    };
  }, [soundOff, isYouTube, ytCommand, tryPlay]);

  // Coming back to the app: if the phone paused the music, pick it up again in step with everyone
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || off.current || userPaused.current) return;
      const v = video.current;
      if (isYouTube || !v || !v.paused || !v.src) return;
      const e = ev.current;
      if (e && !e.stream_url) {
        const pos = playlistPosition(e.media, e.starts_at, now());
        if (pos && pos.index !== idx.current) return loadItem(pos.index, pos.offset);
        if (pos && Number.isFinite(v.duration) && pos.offset < v.duration) v.currentTime = pos.offset;
      }
      tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, isYouTube, tryPlay, loadItem]);

  // Lock-screen and notification controls (also helps phones keep playing in the background)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!active || mediaOff || !kind) {
      ms.metadata = null;
      return;
    }
    try {
      ms.metadata = new MediaMetadata({
        title: titleRef.current || active.title,
        artist: active.title,
        album: "Dashpad",
        artwork: active.cover_url ? [{ src: active.cover_url, sizes: "512x512" }] : [{ src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" }],
      });
      ms.setActionHandler("play", () => {
        userPaused.current = false;
        if (isYouTube) ytCommand("playVideo");
        else tryPlay();
      });
      ms.setActionHandler("pause", () => {
        userPaused.current = true;
        if (isYouTube) ytCommand("pauseVideo");
        else video.current?.pause();
      });
    } catch {
      /* not supported on this browser */
    }
  }, [active, mediaOff, kind, index, isYouTube, ytCommand, tryPlay]);

  // YouTube videos (not live streams): jump to where everyone else is
  useEffect(() => {
    if (!isYouTube || !active) return;
    let synced = false;
    const startsAt = new Date(active.starts_at).getTime();
    const onMsg = (m: MessageEvent) => {
      if (typeof m.origin !== "string" || !m.origin.includes("youtube")) return;
      let d: { event?: string; info?: { duration?: number } } | null = null;
      try {
        d = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
      } catch {
        return;
      }
      const dur = d?.info?.duration;
      if (synced || typeof dur !== "number" || dur <= 1) return;
      synced = true;
      const elapsed = (Date.now() + skew.current - startsAt) / 1000;
      if (elapsed > 2) {
        yt.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [elapsed % dur, true] }), "*");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isYouTube, active]);

  // First time someone sees a video at an event: tell them they can move it
  useEffect(() => {
    if (!isVideo || mediaOff) return;
    try {
      if (localStorage.getItem("dp-video-hint")) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setHint(true), 1200);
    return () => clearTimeout(t);
  }, [isVideo, mediaOff]);
  const dismissHint = () => {
    setHint(false);
    try {
      localStorage.setItem("dp-video-hint", "1");
    } catch {}
  };

  /* ---------- people saying hi ---------- */

  const chatIds = useRef(new Set<string>());
  useEffect(() => {
    if (!active) return;
    const eventId = active.id;
    const title = active.title;
    let alive = true;
    chatIds.current = new Set();
    let t: ReturnType<typeof setTimeout> | null = null;
    const recheck = (p: { new: unknown }) => {
      const row = p.new as { event_id?: string };
      if (row.event_id && row.event_id !== eventId) return;
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        const { data } = await supabase.rpc("my_live_event_chats");
        if (!alive || !Array.isArray(data)) return;
        const open = pathRef.current.match(CHAT_PATH);
        setUnread((u) => {
          const next = { ...u };
          for (const c of data as { id: string; event_id: string; unread: boolean }[]) {
            if (c.event_id !== eventId) continue;
            next[c.id] = c.unread && !(open && open[2] === c.id) ? Math.max(1, u[c.id] ?? 0) : 0;
          }
          return next;
        });
      }, 500);
    };
    supabase.rpc("my_event_chats", { p_event: eventId }).then(({ data }) => {
      if (alive) for (const c of (data ?? []) as { id: string }[]) chatIds.current.add(c.id);
    });
    const ch = supabase
      .channel(`event-notify-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_chats", filter: `event_id=eq.${eventId}` }, (p) => {
        const c = p.new as { id: string; opened_by: string };
        chatIds.current.add(c.id);
        if (c.opened_by !== userId) {
          setToast({ id: Date.now(), text: `Someone at ${title} said hi`, href: `/events/${eventId}/chat/${c.id}` });
          setUnread((u) => ({ ...u, [c.id]: Math.max(1, u[c.id] ?? 0) }));
        }
      })
      // A new message bumps its chat; watch only your own chats, then ask which ones are unread
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_chats", filter: `user_a=eq.${userId}` }, recheck)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_chats", filter: `user_b=eq.${userId}` }, recheck)
      .subscribe();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [active, supabase, userId]);

  // Opening a chat reads it
  useEffect(() => {
    const m = path.match(CHAT_PATH);
    if (m) setUnread((u) => (u[m[2]] ? { ...u, [m[2]]: 0 } : u));
  }, [path]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const clearUnread = useCallback((chatId: string) => setUnread((u) => (u[chatId] ? { ...u, [chatId]: 0 } : u)), []);
  const registerBar = useCallback(() => {
    setBars((b) => b + 1);
    return () => setBars((b) => b - 1);
  }, []);

  /* ---------- where the picture goes ---------- */

  const onEventArea = !!active && path.startsWith(`/events/${active.id}`);
  const onChat = !!chatMatch;
  const mode: "stage" | "pip" | "hidden" =
    !active || !isVideo || quietHere ? "hidden" : stageEl && onEventArea && !onChat ? "stage" : onEventArea && !videoHidden ? "pip" : "hidden";

  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = screen.current;
    if (!el || mode !== "stage" || !stageEl) return;
    let raf = 0;
    const place = () => {
      const r = stageEl.getBoundingClientRect();
      el.style.top = `${r.top}px`;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      raf = requestAnimationFrame(place);
    };
    place();
    return () => {
      cancelAnimationFrame(raf);
      el.style.top = el.style.left = el.style.width = el.style.height = "";
    };
  }, [mode, stageEl]);

  // Drag the little window around
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  function onDragDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: drag.x, oy: drag.y };
  }
  function onDragMove(e: React.PointerEvent) {
    const s = dragStart.current;
    if (!s) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDrag({
      x: Math.max(-w + 180, Math.min(0, s.ox + e.clientX - s.x)),
      y: Math.max(-h + 200, Math.min(h - 200, s.oy + e.clientY - s.y)),
    });
  }

  const media: EventMedia | undefined = active && !active.stream_url ? active.media[index] : undefined;
  const title = !active
    ? ""
    : active.stream_url
      ? isYouTube || hasPicture
        ? "Live stream"
        : "Live audio"
      : media?.title || `Track ${index + 1}`;

  titleRef.current = title;

  const value: EventMediaCtx = {
    active,
    start,
    stop,
    leave,
    mediaOff: !!kind && mediaOff,
    toggle,
    toggleMute,
    playing,
    muted,
    needsTap,
    soundOff,
    hasMedia,
    isVideo,
    isLive: !!active?.stream_url,
    title,
    setStage: setStageEl,
    registerBar,
    videoHidden,
    setVideoHidden,
    unread,
    unreadTotal: Object.values(unread).reduce((s, n) => s + n, 0),
    clearUnread,
  };

  const ytId = active?.stream_url && !mediaOff ? youtubeId(active.stream_url) : null;
  const showFloating = !!active && hasMedia && bars === 0 && !OTHER_FULL_SCREEN.test(path) && !onChat;

  return (
    <Ctx.Provider value={value}>
      {children}
      <style>{PLAYER_CSS}</style>

      {/* The one player that keeps going while you move around the app */}
      <div
        ref={screen}
        aria-hidden={mode === "hidden"}
        style={mode === "pip" ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
        className={clsx(
          "fixed overflow-hidden bg-black",
          mode === "stage" && "z-[41] rounded-3xl lg:z-[5]",
          mode === "pip" &&
            (onChat
              ? "top-[calc(env(safe-area-inset-top)+8.5rem)] right-3 z-[45] aspect-video w-44 rounded-2xl shadow-lift ring-2 ring-white lg:top-36 lg:right-8 lg:w-72"
              : "right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[45] aspect-video w-48 rounded-2xl shadow-lift ring-2 ring-white lg:right-8 lg:bottom-8 lg:w-80"),
          mode === "hidden" &&
            (isYouTube
              ? "pointer-events-none top-0 -left-[2000px] h-[180px] w-[320px] opacity-0"
              : "pointer-events-none bottom-0 left-0 h-px w-px opacity-0"),
        )}
      >
        <video ref={video} playsInline preload="auto" className={clsx("h-full w-full object-contain", isYouTube && "hidden")} />
        {ytId && (
          <iframe
            ref={yt}
            key={active!.id}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1${ytMuted ? "&mute=1" : ""}`}
            onLoad={(ev) => {
              // Ask YouTube to tell us the video length so we can join everyone at the same point
              ev.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
            }}
            title="Live stream"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
        {mode === "pip" && (
          <>
            <div
              onPointerDown={onDragDown}
              onPointerMove={onDragMove}
              onPointerUp={() => (dragStart.current = null)}
              className="absolute inset-x-0 top-0 flex h-7 cursor-grab touch-none items-center justify-center bg-gradient-to-b from-black/50 to-transparent text-white/80 active:cursor-grabbing"
              aria-label="Move video"
            >
              <GripHorizontal size={16} />
            </div>
            <button
              onClick={() => setVideoHidden(true)}
              className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"
              aria-label="Hide video (keep sound)"
            >
              <VideoOff size={14} />
            </button>
          </>
        )}
      </div>

      {showFloating && <FloatingMiniPlayer />}

      {hint && onEventArea && (
        <div role="status" className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm animate-fade-up">
          <div className="flex items-start gap-3 rounded-2xl bg-ink p-3.5 text-white shadow-lift">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
              <GripHorizontal size={18} />
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="block text-[14px] font-semibold">You can move the video</span>
              When you leave the room it shrinks to a small window. Drag its top bar to move it, or tap the camera icon to hide it and keep the sound.
            </p>
            <button onClick={dismissHint} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-ink">
              Got it
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto max-w-sm animate-fade-up">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lift">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <MessageCircle size={20} />
            </span>
            <p className="min-w-0 flex-1 text-[14px] leading-snug font-semibold">{toast.text}</p>
            {toast.href && (
              <Link href={toast.href} onClick={() => setToast(null)} className="rounded-full bg-brand px-3.5 py-2 text-[13px] font-semibold text-white">
                Open
              </Link>
            )}
            <button onClick={() => setToast(null)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Small animations used by the player and the room (transform and opacity only). */
const PLAYER_CSS = `
@keyframes dp-eq { 0%,100% { transform: scaleY(0.3) } 50% { transform: scaleY(1) } }
.dp-eq > span { transform-origin: bottom; animation: dp-eq 0.9s ease-in-out infinite; }
.dp-eq > span:nth-child(2) { animation-delay: -0.3s; animation-duration: 0.8s; }
.dp-eq > span:nth-child(3) { animation-delay: -0.6s; animation-duration: 1.1s; }
.dp-eq > span:nth-child(4) { animation-delay: -0.15s; animation-duration: 0.95s; }
.dp-eq.paused > span { animation-play-state: paused; }
@keyframes dp-rise {
  0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
  12% { transform: translate(calc(var(--dx) * 0.2), -30px) scale(1.15); opacity: 1; }
  100% { transform: translate(var(--dx), -240px) scale(0.9); opacity: 0; }
}
.dp-rise { animation: dp-rise 2.4s cubic-bezier(0.2, 0.7, 0.3, 1) forwards; will-change: transform, opacity; }
@keyframes dp-pop-heart {
  0% { transform: translateY(20px) scale(0.4); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(-160px) scale(1.1); opacity: 0; }
}
.dp-pop-heart { animation: dp-pop-heart 2.8s ease-out infinite; }
`;
