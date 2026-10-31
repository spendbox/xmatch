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
const tell = () => listeners.forEach((l) => l(current));

export function playIntro(key: string, src?: string) {
  if (typeof Audio === "undefined") return;
  audio ??= new Audio();
  if (current === key && !audio.paused) {
    audio.pause();
    current = null;
    return tell();
  }
  audio.pause();
  audio.src = src ?? voiceUrl(key) ?? "";
  audio.onended = () => {
    current = null;
    tell();
  };
  current = key;
  tell();
  void audio.play().catch(() => {
    current = null;
    tell();
  });
}

export function stopIntro() {
  audio?.pause();
  current = null;
  tell();
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
