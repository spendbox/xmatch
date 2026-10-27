"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Drawing, Stroke } from "@/lib/scribble";

/** Their scribble in progress, while they've chosen to let you see it */
export type TheirScribble = { drawing: Drawing; live: Stroke | null } | null;

// Their preview goes away if nothing arrives for this long (they closed the app, lost signal…)
const QUIET_MS = 20_000;

/**
 * "Let them see": your scribble goes to the other person as you draw it (nothing is saved; it's
 * passed straight across), and theirs comes to you. One live channel per chat.
 */
export function useScribbleLive(chatKey: string | null, me: string) {
  const supabase = useMemo(() => createClient(), []);
  const channel = useRef<RealtimeChannel | null>(null);
  const [theirs, setTheirs] = useState<TheirScribble>(null);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLive = useRef(0);
  const pendingLive = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!chatKey) return;
    // Joins a moment after the chat opens, so it never slows the chat itself down
    let ch: RealtimeChannel | null = null;
    const stillThere = () => {
      if (quiet.current) clearTimeout(quiet.current);
      quiet.current = setTimeout(() => setTheirs(null), QUIET_MS);
    };
    const join = setTimeout(() => {
      ch = supabase
        .channel(`scribble:${chatKey}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "snap" }, ({ payload }) => {
          if (payload?.u === me) return;
          stillThere();
          setTheirs((t) => ({ drawing: payload.d as Drawing, live: t?.live ?? null }));
        })
        .on("broadcast", { event: "live" }, ({ payload }) => {
          if (payload?.u === me) return;
          stillThere();
          setTheirs((t) => ({ drawing: t?.drawing ?? { v: 1, strokes: [] }, live: (payload.s as Stroke | null) ?? null }));
        })
        .on("broadcast", { event: "end" }, ({ payload }) => {
          if (payload?.u === me) return;
          setTheirs(null);
        })
        .subscribe();
      channel.current = ch;
    }, 1500);
    return () => {
      clearTimeout(join);
      if (quiet.current) clearTimeout(quiet.current);
      if (pendingLive.current) clearTimeout(pendingLive.current);
      if (ch) void supabase.removeChannel(ch);
      channel.current = null;
      setTheirs(null);
    };
  }, [supabase, chatKey, me]);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channel.current?.send({ type: "broadcast", event, payload: { ...payload, u: me } });
  }, [me]);

  /** What you've drawn so far (sent when it changes) */
  const publish = useCallback((d: Drawing) => send("snap", { d }), [send]);

  /** The line you're drawing right now: at most about 12 times a second */
  const publishLive = useCallback(
    (s: Stroke | null) => {
      const go = () => {
        lastLive.current = performance.now();
        pendingLive.current = null;
        send("live", { s: s ? { ...s, p: [...s.p] } : null });
      };
      if (!s) {
        if (pendingLive.current) clearTimeout(pendingLive.current);
        pendingLive.current = null;
        return go();
      }
      const wait = 80 - (performance.now() - lastLive.current);
      if (wait <= 0) go();
      else if (!pendingLive.current) pendingLive.current = setTimeout(go, wait);
    },
    [send],
  );

  /** Stop showing them (sent, closed, or switched off) */
  const end = useCallback(() => send("end", {}), [send]);

  return { theirs, share: { publish, publishLive, end } };
}
export type ScribbleShare = ReturnType<typeof useScribbleLive>["share"];
