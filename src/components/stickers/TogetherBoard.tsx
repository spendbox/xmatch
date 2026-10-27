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
  // Your lines not yet saved: added, and taken back (saved line by line, so you never overwrite theirs)
  const pendAdd = useRef(new Map<string, Stroke>());
  const pendRemove = useRef(new Set<string>());

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

  /** Save your new and taken-back lines (a moment after you draw, and when you leave) */
  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!pendAdd.current.size && !pendRemove.current.size) return;
    const add = [...pendAdd.current.values()];
    const remove = [...pendRemove.current];
    pendAdd.current = new Map();
    pendRemove.current = new Set();
    const { error } = await supabase.rpc("draw_lines", { p_id: id, p_add: add, p_remove: remove });
    if (!error) return;
    if (error.message.includes("draw_lines")) {
      // Before update 97: save the whole board instead
      await supabase.rpc("save_draw", { p_id: id, p_drawing: latest.current });
      return;
    }
    if (error.message.includes("full")) return setError(error.message);
    // Couldn't save (no signal): keep them for the next try
    add.forEach((st) => st.id && !pendAdd.current.has(st.id) && pendAdd.current.set(st.id, st));
    remove.forEach((x) => pendRemove.current.add(x));
  }, [supabase, id]);
  const flushSoon = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  /** The board as saved (with their lines from while you were away), plus yours not saved yet */
  const load = useCallback(async () => {
    const { data } = await supabase.from("draw_sessions").select("drawing, status").eq("id", id).maybeSingle();
    const row = data as { drawing: unknown; status: string } | null;
    if (row && row.status !== "open") return onClose(row.status === "sent" ? "That drawing was sent" : "That drawing was closed");
    if (!row || !isDrawing(row.drawing)) return;
    const saved = row.drawing.strokes.filter((st) => !st.id || !pendRemove.current.has(st.id));
    const ids = new Set(saved.map((st) => st.id));
    const mine = [...pendAdd.current.values()].filter((st) => !ids.has(st.id));
    setDrawing((d) => ({ ...d, strokes: [...saved, ...mine] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, id]);

  // Leaving the app or the page: save now. Coming back: catch up on what they drew meanwhile
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") void flush();
      else void flush().then(load);
    };
    const onHide = () => void flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush, load]);

  useEffect(() => {
    // What's on the board so far, then live from here on
    void load();
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
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, id, me]);

  function change(next: Drawing) {
    const before = new Set(drawing.strokes.map((s) => s.id));
    const after = new Set(next.strokes.map((s) => s.id));
    const added = next.strokes.filter((s) => s.id && !before.has(s.id));
    const removed = drawing.strokes.filter((s) => s.id && !after.has(s.id)).map((s) => s.id!);
    setDrawing(next);
    added.forEach((st) => {
      send("add", { s: st });
      pendAdd.current.set(st.id!, st);
    });
    if (removed.length) {
      send("remove", { ids: removed });
      removed.forEach((x) => (pendAdd.current.has(x) ? pendAdd.current.delete(x) : pendRemove.current.add(x)));
    }
    flushSoon();
  }

  function live(s: Stroke | null) {
    const now = performance.now();
    if (s && now - lastLive.current < 70) return;
    lastLive.current = now;
    send("live", { s: s ? { ...s, p: [...s.p] } : null });
  }

  async function close() {
    await flush();
    // An empty board gets its Keys back straight away
    if (!latest.current.strokes.length) await supabase.rpc("close_draw", { p_id: id });
    onClose();
  }

  async function sendIt() {
    setSending(true);
    setError(null);
    await flush();
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
          <p className={here ? "text-[12px] font-semibold text-mint" : "text-[12px] text-muted"}>{here ? `${them.name} is here` : `${them.name} can add to it any time`}</p>
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
