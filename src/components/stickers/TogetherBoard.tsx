"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { lockScroll } from "@/lib/scrollLock";
import { TOGETHER_H, TOGETHER_W, isDrawing, type Drawing, type Stroke } from "@/lib/scribble";
import type { ChatMessage } from "@/lib/types";
import { ScribblePad } from "./Scribble";

const THEM_COLOR = "#2fb3a0";

/**
 * Drawing together: one wide board you both draw on, live. Lines go across as they're drawn;
 * the board is also kept on the server, so whoever opens it later sees what's there.
 * Either of you sends it to the chat as one painting.
 */
export function TogetherBoard({
  id,
  me,
  them,
  onClose,
  onSent,
}: {
  id: string;
  me: string;
  them: { name: string; letter?: string };
  onClose: (note?: string) => void;
  /** The painting, now a message in the chat */
  onSent: (m: ChatMessage) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [drawing, setDrawing] = useState<Drawing>({ v: 1, w: TOGETHER_W, h: TOGETHER_H, strokes: [] });
  const [theirLive, setTheirLive] = useState<Stroke | null>(null);
  const [here, setHere] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const latest = useRef(drawing);
  latest.current = drawing;
  const lastLive = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => lockScroll(), []);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channel.current?.send({ type: "broadcast", event, payload: { ...payload, u: me } });
  }, [me]);

  // Lines from either of you, in the order they arrived (one copy of each)
  const merge = useCallback((list: Stroke[]) => {
    setDrawing((d) => {
      const have = new Set(d.strokes.map((s) => s.id));
      const add = list.filter((s) => s.id && !have.has(s.id));
      return add.length ? { ...d, strokes: [...d.strokes, ...add] } : d;
    });
  }, []);

  useEffect(() => {
    // What's on the board so far, then live from here on
    void supabase
      .from("draw_sessions")
      .select("drawing, status")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { drawing: unknown; status: string } | null;
        if (row && row.status !== "open") return onClose(row.status === "sent" ? "That drawing was sent" : "That drawing was closed");
        if (row && isDrawing(row.drawing)) merge(row.drawing.strokes);
      });
    const ch = supabase
      .channel(`draw:${id}`, { config: { broadcast: { self: false }, presence: { key: me } } })
      .on("broadcast", { event: "add" }, ({ payload }) => {
        if (payload?.u === me) return;
        merge([payload.s as Stroke]);
        setTheirLive(null);
      })
      .on("broadcast", { event: "live" }, ({ payload }) => payload?.u !== me && setTheirLive((payload.s as Stroke | null) ?? null))
      .on("broadcast", { event: "remove" }, ({ payload }) => {
        if (payload?.u === me) return;
        const ids = new Set(payload.ids as string[]);
        setDrawing((d) => ({ ...d, strokes: d.strokes.filter((s) => !s.id || !ids.has(s.id)) }));
      })
      .on("broadcast", { event: "hello" }, ({ payload }) => payload?.u !== me && send("state", { strokes: latest.current.strokes }))
      .on("broadcast", { event: "state" }, ({ payload }) => payload?.u !== me && merge(payload.strokes as Stroke[]))
      .on("broadcast", { event: "sent" }, ({ payload }) => payload?.u !== me && onClose(`${them.name} sent it`))
      .on("presence", { event: "sync" }, () => setHere(Object.keys(ch.presenceState()).some((k) => k !== me)))
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void ch.track({ at: Date.now() });
        send("hello", {});
      });
    channel.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      channel.current = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, id, me]);

  // Keep the board on the server a moment after each change
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void supabase.rpc("save_draw", { p_id: id, p_drawing: latest.current }), 1500);
  }, [drawing, supabase, id]);

  function change(next: Drawing) {
    const before = new Set(drawing.strokes.map((s) => s.id));
    const after = new Set(next.strokes.map((s) => s.id));
    const added = next.strokes.filter((s) => s.id && !before.has(s.id));
    const removed = drawing.strokes.filter((s) => s.id && !after.has(s.id)).map((s) => s.id!);
    setDrawing(next);
    added.forEach((s) => send("add", { s }));
    if (removed.length) send("remove", { ids: removed });
  }

  function live(s: Stroke | null) {
    const now = performance.now();
    if (s && now - lastLive.current < 70) return;
    lastLive.current = now;
    send("live", { s: s ? { ...s, p: [...s.p] } : null });
  }

  async function close() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await supabase.rpc("save_draw", { p_id: id, p_drawing: latest.current });
    // An empty board gets its Keys back straight away
    if (!latest.current.strokes.length) await supabase.rpc("close_draw", { p_id: id });
    onClose();
  }

  async function sendIt() {
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("send_draw", { p_id: id, p_drawing: latest.current });
    setSending(false);
    if (err) return setError(err.message.includes("Draw something") || err.message.includes("too big") || err.message.includes("already") ? err.message : "Couldn't send it. Check your connection.");
    send("sent", {});
    onSent(data as ChatMessage);
    onClose();
  }

  if (!mounted) return null;
  const vw = window.innerWidth;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface pb-safe" style={{ paddingTop: "env(safe-area-inset-top)" }} role="dialog" aria-modal="true" aria-label={`Drawing with ${them.name}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => void close()} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5" aria-label="Close">
          <ArrowLeft size={21} />
        </button>
        <div className="flex">
          <span className="relative grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-white ring-2 ring-surface" style={{ background: THEM_COLOR }}>
            {(them.letter ?? them.name).slice(0, 1).toUpperCase()}
            {here && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-surface" />}
          </span>
        </div>
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[16px] leading-tight font-semibold">Drawing with {them.name}</p>
          <p className={here ? "text-[12px] font-semibold text-mint" : "text-[12px] text-muted"}>{here ? `${them.name} is here` : `Waiting for ${them.name}…`}</p>
        </div>
        <Button onClick={() => void sendIt()} loading={sending} disabled={!drawing.strokes.length} className="h-10 rounded-full px-4">
          <SendHorizontal size={16} /> Send
        </Button>
      </div>
      {error && <p className="px-4 pb-1 text-center text-[13px] font-medium text-chili">{error}</p>}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-3 pb-4">
        <ScribblePad
          drawing={drawing}
          onChange={change}
          maxSize={Math.min(720, vw - 24)}
          expanded
          author={me}
          onLive={live}
          remote={theirLive ? [{ stroke: theirLive, name: them.name, color: THEM_COLOR }] : []}
        />
      </div>
    </div>,
    document.body,
  );
}
