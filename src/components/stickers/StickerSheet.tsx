"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Clock3, Lock, SendHorizontal } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { STICKER_COLORS, STICKER_MAX, STICKER_PACKS, isPose, isStickerColor, packOf, type Sticker, type StickerPack, type StickerPose } from "@/lib/stickers";
import { Masky } from "./Masky";

export type StickerPick = { pose: StickerPose; caption: string; color: string };

const RECENT_KEY = "dp_recent_stickers";
const TAB_KEY = "dp_sticker_tab";

function loadRecent(): StickerPick[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as StickerPick[];
    return list.filter((s) => isPose(s.pose) && isStickerColor(s.color) && typeof s.caption === "string").slice(0, 9);
  } catch {
    return [];
  }
}
function saveRecent(s: StickerPick) {
  try {
    const list = [s, ...loadRecent().filter((x) => !(x.pose === s.pose && x.caption === s.caption && x.color === s.color))].slice(0, 9);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

/** Masky stickers: pick one, change its words (and colour) if you like, then send. Packs are bought once with Keys. */
export function StickerSheet({
  open,
  onClose,
  onSend,
  owned = [],
  price = 40,
  onBuy,
  startTab,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (s: StickerPick) => void;
  /** Packs you've bought */
  owned?: string[];
  /** Keys for one pack */
  price?: number;
  /** Buy a pack: returns an error to show, or null */
  onBuy?: (pack: StickerPack) => Promise<string | null>;
  startTab?: string;
}) {
  const [picked, setPicked] = useState<{ base: Sticker; caption: string; color: string } | null>(null);
  const [recent, setRecent] = useState<StickerPick[]>([]);
  const [tab, setTab] = useState<string>("masky");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setError(null);
    const r = loadRecent();
    setRecent(r);
    let t = startTab;
    try {
      t ??= localStorage.getItem(TAB_KEY) ?? undefined;
    } catch {
      /* private mode */
    }
    setTab(t && (t === "recent" ? r.length > 0 : STICKER_PACKS.some((p) => p.id === t)) ? t : r.length ? "recent" : "masky");
  }, [open, startTab]);

  const has = (p: StickerPack | undefined) => !!p && (p.free || owned.includes(p.id));
  const pack = STICKER_PACKS.find((p) => p.id === tab);
  const pickedPack = picked ? packOf(picked.base.pose) : undefined;
  const locked = !!picked && !has(pickedPack);

  function pickTab(id: string) {
    tapFeedback();
    setTab(id);
    setError(null);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* private mode */
    }
  }

  function choose(s: StickerPick) {
    tapFeedback();
    const base = packOf(s.pose)?.stickers.find((x) => x.pose === s.pose);
    if (!base) return;
    setError(null);
    setPicked({ base, caption: s.caption, color: s.color });
  }

  function send() {
    if (!picked || locked) return;
    const s = { pose: picked.base.pose, caption: picked.caption.trim() || picked.base.caption, color: picked.color };
    tapFeedback();
    saveRecent(s);
    onClose();
    onSend(s);
  }

  async function buy(p: StickerPack) {
    if (!onBuy) return;
    setBuying(true);
    setError(null);
    const err = await onBuy(p);
    setBuying(false);
    if (err) setError(err);
  }

  const buyButton = (p: StickerPack, full?: boolean) => (
    <Button onClick={() => void buy(p)} loading={buying} className={clsx("h-12 rounded-full", full ? "w-full" : "flex-1")}>
      Get {p.name} · <KeyCoin size={18} /> {price}
    </Button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picked ? (locked ? `${pickedPack?.name} pack ${pickedPack?.emoji}` : "Make it yours") : "Stickers"}
      subtitle={picked ? (locked ? "Get the pack to send this one, with your own words" : "Change the words, then send") : undefined}
      footer={
        picked ? (
          <div className="space-y-2">
            {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-semibold text-ink-soft transition active:scale-95"
              >
                <ArrowLeft size={18} /> All
              </button>
              {locked && pickedPack ? (
                buyButton(pickedPack)
              ) : (
                <Button onClick={send} className="h-12 flex-1 rounded-full">
                  <SendHorizontal size={18} /> Send
                </Button>
              )}
            </div>
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
            <button type="button" onClick={() => setPicked((p) => p && { ...p, caption: p.base.caption })} className="-mt-2 text-[13px] font-semibold text-brand">
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
        <div className="-mt-2">
          {/* Packs */}
          <div role="tablist" aria-label="Sticker packs" className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-3">
            {recent.length > 0 && (
              <TabChip on={tab === "recent"} onClick={() => pickTab("recent")} label="Recent">
                <Clock3 size={15} />
              </TabChip>
            )}
            {STICKER_PACKS.map((p) => (
              <TabChip key={p.id} on={tab === p.id} onClick={() => pickTab(p.id)} label={p.name} locked={!has(p)}>
                <span className="text-[15px] leading-none">{p.emoji}</span>
              </TabChip>
            ))}
          </div>

          <div className="max-h-[52dvh] overflow-y-auto pb-2">
            {tab === "recent" ? (
              <div className="grid grid-cols-3 gap-1">
                {recent.map((s, i) => (
                  <StickerTile key={i} s={s} onClick={() => choose(s)} />
                ))}
              </div>
            ) : pack ? (
              <>
                {!has(pack) && (
                  <div className="mb-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1f4d] to-[#5b3fd9] p-4 text-white">
                    <p className="text-[12px] font-bold tracking-wide text-white/70 uppercase">Premium pack</p>
                    <p className="mt-0.5 text-[19px] font-semibold">
                      {pack.name} {pack.emoji}
                    </p>
                    <p className="text-[13.5px] text-white/80">
                      {pack.tagline} · {pack.stickers.length} moving stickers, your own words on every one. Yours to keep.
                    </p>
                    <div className="mt-3">{onBuy ? buyButton(pack, true) : null}</div>
                    {error && <p className="mt-2 text-center text-[13px] font-medium text-[#ffb4b4]">{error}</p>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1">
                  {pack.stickers.map((s) => (
                    <StickerTile key={s.pose} s={s} locked={!has(pack)} onClick={() => choose(s)} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function TabChip({ on, onClick, label, locked, children }: { on: boolean; onClick: () => void; label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition active:scale-95",
        on ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft",
      )}
    >
      {children}
      {label}
      {locked && <Lock size={12} className={on ? "text-white/70" : "text-muted"} />}
    </button>
  );
}

function StickerTile({ s, locked, onClick }: { s: StickerPick & { move?: string }; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid place-items-center rounded-2xl py-1.5 transition hover:bg-cream active:scale-95"
      aria-label={`${s.caption}${s.move ? `: ${s.move}` : ""}${locked ? " (in a pack)" : ""}`}
    >
      <Masky pose={s.pose} caption={s.caption} color={s.color} size={96} />
      {locked && (
        <span className="absolute top-1.5 right-2 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-white">
          <Lock size={12} />
        </span>
      )}
    </button>
  );
}

/** A sticker sent in a chat (falls back to a waving Masky if something's missing) */
export function stickerOf(meta: { pose?: unknown; color?: unknown } | null | undefined, caption: string): StickerPick {
  return { pose: isPose(meta?.pose) ? meta.pose : "wave", color: isStickerColor(meta?.color) ? meta.color : "#7a5cf0", caption };
}
