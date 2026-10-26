"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { STICKERS, STICKER_COLORS, STICKER_MAX, isPose, isStickerColor, type Sticker, type StickerPose } from "@/lib/stickers";
import { Masky } from "./Masky";

export type StickerPick = { pose: StickerPose; caption: string; color: string };

const RECENT_KEY = "dp_recent_stickers";

function loadRecent(): StickerPick[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as StickerPick[];
    return list.filter((s) => isPose(s.pose) && isStickerColor(s.color) && typeof s.caption === "string").slice(0, 6);
  } catch {
    return [];
  }
}
function saveRecent(s: StickerPick) {
  try {
    const list = [s, ...loadRecent().filter((x) => !(x.pose === s.pose && x.caption === s.caption && x.color === s.color))].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

/** Masky stickers: pick one, change its words (and colour) if you like, then send. */
export function StickerSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (s: StickerPick) => void }) {
  const [picked, setPicked] = useState<{ base: Sticker; caption: string; color: string } | null>(null);
  const [recent, setRecent] = useState<StickerPick[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setRecent(loadRecent());
  }, [open]);

  function choose(s: StickerPick) {
    tapFeedback();
    const base = STICKERS.find((x) => x.pose === s.pose) ?? STICKERS[0];
    setPicked({ base, caption: s.caption, color: s.color });
  }

  function send() {
    if (!picked) return;
    const s = { pose: picked.base.pose, caption: picked.caption.trim() || picked.base.caption, color: picked.color };
    tapFeedback();
    saveRecent(s);
    onClose();
    onSend(s);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picked ? "Make it yours" : "Stickers"}
      subtitle={picked ? "Change the words, then send" : "Tap one to change its words. Free for now."}
      footer={
        picked ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-semibold text-ink-soft transition active:scale-95"
            >
              <ArrowLeft size={18} /> All
            </button>
            <Button onClick={send} className="h-12 flex-1 rounded-full">
              <SendHorizontal size={18} /> Send
            </Button>
          </div>
        ) : undefined
      }
    >
      {picked ? (
        <div className="space-y-4">
          <div className="grid place-items-center rounded-3xl bg-brand-soft/60 py-3">
            <Masky pose={picked.base.pose} caption={picked.caption.trim() || picked.base.caption} color={picked.color} size={170} />
          </div>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-[13px] font-semibold text-muted">
              <span>Words on the sticker</span>
              <span className="tabular-nums">
                {picked.caption.length} / {STICKER_MAX}
              </span>
            </span>
            <input
              ref={input}
              value={picked.caption}
              onChange={(e) => setPicked((p) => p && { ...p, caption: e.target.value.slice(0, STICKER_MAX) })}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={STICKER_MAX}
              enterKeyHint="send"
              className="h-12 w-full rounded-2xl border-2 border-brand/40 bg-surface px-4 text-[17px] font-semibold outline-none focus:border-brand"
              aria-label="Words on the sticker"
            />
          </label>
          {picked.caption !== picked.base.caption && (
            <button
              type="button"
              onClick={() => setPicked((p) => p && { ...p, caption: p.base.caption })}
              className="-mt-2 text-[13px] font-semibold text-brand"
            >
              Back to &ldquo;{picked.base.caption}&rdquo;
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-muted">Colour</span>
            {STICKER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPicked((p) => p && { ...p, color: c.id })}
                aria-label={c.name}
                aria-pressed={picked.color === c.id}
                className={clsx("h-8 w-8 rounded-full ring-offset-2 transition active:scale-90", picked.color === c.id ? "ring-2 ring-ink" : "ring-1 ring-line")}
                style={{ background: c.id }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[56dvh] overflow-y-auto pb-2">
          {recent.length > 0 && (
            <>
              <p className="mb-1 text-[12px] font-bold tracking-wide text-muted uppercase">Recent</p>
              <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
                {recent.map((s, i) => (
                  <button key={i} type="button" onClick={() => choose(s)} className="shrink-0 rounded-2xl p-1 transition active:scale-95" aria-label={`${s.caption} sticker`}>
                    <Masky pose={s.pose} caption={s.caption} color={s.color} size={76} still />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="mb-1 text-[12px] font-bold tracking-wide text-muted uppercase">Masky</p>
          <div className="grid grid-cols-3 gap-1">
            {STICKERS.map((s) => (
              <button
                key={s.pose}
                type="button"
                onClick={() => choose(s)}
                className="grid place-items-center rounded-2xl py-1.5 transition hover:bg-cream active:scale-95"
                aria-label={`${s.caption}: ${s.move}`}
              >
                <Masky pose={s.pose} caption={s.caption} color={s.color} size={96} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** A sticker sent in a chat (falls back to a waving Masky if something's missing) */
export function stickerOf(meta: { pose?: unknown; color?: unknown } | null | undefined, caption: string): StickerPick {
  return { pose: isPose(meta?.pose) ? meta.pose : "wave", color: isStickerColor(meta?.color) ? meta.color : "#7a5cf0", caption };
}
