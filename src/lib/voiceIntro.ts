"use client";

import { useEffect, useState } from "react";
import { voiceUrl } from "./voiceDisguise";

/**
 * One player for voice intros across the app: starting one stops whatever else was playing,
 * and every "Hear me" button knows which one is on.
 */
let audio: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<(key: string | null) => void>();
const tell = () => {
  listeners.forEach((l) => l(current));
  tellProgress();
};

// Where the playing one is up to (0 to 1), its length, and whether it's still loading
type Progress = { key: string | null; at: number; length: number; loading: boolean };
let progress: Progress = { key: null, at: 0, length: 0, loading: false };
const progressListeners = new Set<(p: Progress) => void>();
function tellProgress() {
  const a = audio;
  const length = a && isFinite(a.duration) ? a.duration : 0;
  progress = {
    key: current,
    at: current && a && length ? Math.min(1, a.currentTime / length) : 0,
    length,
    loading: !!current && !!a && a.readyState < 3 && !a.paused,
  };
  progressListeners.forEach((l) => l(progress));
}
let raf: number | null = null;
function follow() {
  if (raf != null) cancelAnimationFrame(raf);
  const tick = () => {
    tellProgress();
    raf = current && audio && !audio.paused ? requestAnimationFrame(tick) : null;
  };
  raf = requestAnimationFrame(tick);
}

export function playIntro(key: string, src?: string) {
  if (typeof Audio === "undefined") return;
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("waiting", tellProgress);
    audio.addEventListener("playing", () => {
      tellProgress();
      follow();
    });
    audio.addEventListener("loadedmetadata", tellProgress);
  }
  if (current === key && !audio.paused) {
    audio.pause();
    current = null;
    return tell();
  }
  audio.pause();
  audio.src = src ?? voiceUrl(key) ?? "";
  audio.currentTime = 0;
  audio.onended = () => {
    current = null;
    tell();
  };
  // A file that won't play (gone, or no connection): stop showing it as playing
  audio.onerror = () => {
    current = null;
    tell();
  };
  current = key;
  tell();
  void audio
    .play()
    .then(follow)
    .catch(() => {
      current = null;
      tell();
    });
}

export function stopIntro() {
  audio?.pause();
  current = null;
  tell();
}

/** How far the one with this key has played (at: 0 to 1), its length in seconds, and if it's loading */
export function usePlayProgress(key: string) {
  const [p, setP] = useState<Progress>(progress);
  useEffect(() => {
    const l = (n: Progress) => setP((old) => (n.key === key || old.key === key ? n : old));
    progressListeners.add(l);
    return () => {
      progressListeners.delete(l);
    };
  }, [key]);
  return p.key === key ? p : { key, at: 0, length: 0, loading: false };
}

/** Which intro is playing right now (its key), or null */
export function usePlayingIntro() {
  const [key, setKey] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setKey);
    return () => {
      listeners.delete(setKey);
    };
  }, []);
  return key;
}
