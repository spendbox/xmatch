"use client";

import { useEffect, useState } from "react";

/** Whether a game is on screen right now (message pop-ups keep quiet while it is) */
let open = 0;
const EVENT = "dp:playing";

export function markPlaying() {
  open++;
  window.dispatchEvent(new Event(EVENT));
  return () => {
    open = Math.max(0, open - 1);
    window.dispatchEvent(new Event(EVENT));
  };
}

export const isPlaying = () => open > 0;

export function usePlaying() {
  const [on, setOn] = useState(isPlaying);
  useEffect(() => {
    const update = () => setOn(isPlaying());
    window.addEventListener(EVENT, update);
    update();
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return on;
}
