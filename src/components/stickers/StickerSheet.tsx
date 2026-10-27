"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Clock3, Eye, Lock, SendHorizontal, Users } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { STICKER_COLORS, STICKER_MAX, STICKER_PACKS, isPose, isStickerColor, packOf, type Sticker, type StickerPack, type StickerPose } from "@/lib/stickers";
import { Masky } from "./Masky";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ScribblePad, ScribbleView, emptyDrawing } from "./Scribble";
import { useSavedScribbles } from "./useSavedScribbles";
import { useStickerPacks } from "./useStickerPacks";
import { usePrices } from "@/components/keys/usePrices";
import type { Drawing } from "@/lib/scribble";
import type { ScribbleShare } from "./useScribbleLive";

export type StickerPick = { pose: StickerPose; caption: string; color: string };
export type ScribbleSend = { drawing?: Drawing; saved?: string; keep: boolean };


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
  owned: ownedProp,
  price: priceProp,
  onBuy: onBuyProp,
  startTab,
  onSendScribble,
  scribbleCost: scribbleProp,
  startMode = "stickers",
  together,
  share,
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
  /** Turn on scribbles: send a new drawing (keep: also save it), or a saved one (free). Returns an error to show, or null. */
  onSendScribble?: (s: ScribbleSend) => Promise<string | null>;
  scribbleCost?: number;
  startMode?: "stickers" | "scribble";
  /** Drawing with the other person: their name, its Keys, and starting it (opens the big shared board) */
  together?: { name: string; cost: number; onStart: () => void };
  /** "Let them see": your scribble goes to them as you draw */
  share?: ScribbleShare;
}) {
  const packs = useStickerPacks();
  const prices = usePrices();
  const owned = ownedProp ?? packs.owned;
  const price = priceProp ?? prices.sticker_pack_cost;
  const onBuy = onBuyProp ?? packs.buy;
  const scribbleCost = scribbleProp ?? prices.scribble_cost;
  const [mode, setMode] = useState<"stickers" | "scribble">(startMode);
  const [drawing, setDrawing] = useState<Drawing>(emptyDrawing);
  const [sending, setSending] = useState(false);
  const { saved, remove: removeSaved } = useSavedScribbles();
  const [savedPick, setSavedPick] = useState<string | null>(null);
  // Every scribble you send is saved, to send again for free
  const keep = true;
  const [expanded, setExpanded] = useState(false);
  const [letSee, setLetSee] = useState(false);
  // Showing them: what's drawn so far whenever it changes; stops when switched off or closed
  const showing = open && letSee && mode === "scribble" && !!share;
  useEffect(() => {
    if (showing) share?.publish(drawing);
  }, [showing, drawing, share]);
  const wasShowing = useRef(false);
  useEffect(() => {
    if (wasShowing.current && !showing) share?.end();
    wasShowing.current = showing;
  }, [showing, share]);
  const [bigSize, setBigSize] = useState(360);
  // The big drawing space fills the screen, leaving room for the tools
  useEffect(() => {
    if (!expanded) return;
    const fit = () => setBigSize(Math.max(220, Math.min(window.innerWidth - 24, window.innerHeight - 290, 720)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [expanded]);
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
    setMode(onSendScribble ? startMode : "stickers");
    setDrawing(emptyDrawing());
    setSavedPick(null);
    setExpanded(false);
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

  async function sendScribble() {
    if (!onSendScribble || (!savedPick && !drawing.strokes.length)) return;
    tapFeedback();
    setSending(true);
    setError(null);
    const err = await onSendScribble(savedPick ? { saved: savedPick, keep: false } : { drawing, keep });
    setSending(false);
    if (err) return setError(err);
    setExpanded(false);
    onClose();
  }

  const scribbling = mode === "scribble" && !picked;
  const pickedSaved = saved.find((x) => x.id === savedPick);
  const canSendScribble = !!pickedSaved || drawing.strokes.length > 0;
  const sendLabel = (
    <>
      <SendHorizontal size={18} /> {pickedSaved ? "Send" : "Send scribble"}
      {pickedSaved ? (
        <> · Free</>
      ) : scribbleCost > 0 ? (
        <>
          {" "}
          · <KeyCoin size={18} /> {scribbleCost}
        </>
      ) : null}
    </>
  );

  const buyButton = (p: StickerPack, full?: boolean) => (
    <Button onClick={() => void buy(p)} loading={buying} className={clsx("h-12 rounded-full", full ? "w-full" : "flex-1")}>
      Get {p.name} · <KeyCoin size={18} /> {price}
    </Button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picked ? (locked ? `${pickedPack?.name} pack ${pickedPack?.emoji}` : "Make it yours") : scribbling ? "Scribble" : "Stickers"}
      subtitle={picked ? (locked ? "Get the pack to send this one, with your own words" : "Change the words, then send") : undefined}
      footer={
        scribbling ? (
          <div className="space-y-2.5">
            {!pickedSaved && together && (
              <div className="grid grid-cols-2 gap-2">
                <ChipToggle on={letSee} onClick={() => setLetSee((v) => !v)} icon={<Eye size={17} />}>
                  Let {together.name} see
                </ChipToggle>
                <ChipToggle
                  on={false}
                  onClick={() => {
                    // Drawing together shows them everything anyway
                    onClose();
                    together.onStart();
                  }}
                  icon={<Users size={17} />}
                  badge={together.cost > 0 ? <><KeyCoin size={13} /> {together.cost}</> : undefined}
                >
                  Draw together
                </ChipToggle>
              </div>
            )}
            {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
            <Button onClick={() => void sendScribble()} loading={sending} disabled={!canSendScribble} className="h-12 w-full rounded-full">
              {sendLabel}
            </Button>
          </div>
        ) : picked ? (
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
      {!picked && onSendScribble && (
        <div role="tablist" aria-label="Stickers or scribble" className="-mt-2 mb-3 grid grid-cols-2 rounded-full bg-cream p-1">
          {(["stickers", "scribble"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                tapFeedback();
                setMode(m);
                setError(null);
              }}
              className={clsx("h-10 rounded-full text-[14.5px] font-semibold transition", mode === m ? "bg-surface text-ink shadow-card" : "text-muted")}
            >
              {m === "stickers" ? "Stickers" : "Scribble"}
            </button>
          ))}
        </div>
      )}
      {scribbling ? (
        <div className="space-y-3">
          {pickedSaved ? (
            <div className="relative grid place-items-center rounded-[28px] bg-[#f6f2fd] py-4 ring-1 ring-brand/15">
              <ScribbleView key={pickedSaved.id} drawing={pickedSaved.drawing} size={240} />
              <button
                type="button"
                onClick={() => setSavedPick(null)}
                className="absolute top-2.5 left-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-ink-soft shadow-card transition active:scale-95"
              >
                <ArrowLeft size={15} /> Draw instead
              </button>
            </div>
          ) : expanded ? (
            <div className="grid h-40 place-items-center rounded-[28px] bg-[#f6f2fd] text-[14px] font-medium text-brand/60">Drawing in the big space…</div>
          ) : (
            <ScribblePad drawing={drawing} onChange={setDrawing} maxSize={380} onExpand={() => setExpanded(true)} onLive={showing ? share?.publishLive : undefined} />
          )}
          {saved.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold tracking-wide text-muted uppercase">Saved · free to send</p>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pt-1.5 pb-1">
                {saved.map((x) => (
                  <div key={x.id} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        tapFeedback();
                        setSavedPick(savedPick === x.id ? null : x.id);
                        setError(null);
                      }}
                      aria-pressed={savedPick === x.id}
                      aria-label="Saved scribble"
                      className={clsx("grid h-[72px] w-[72px] place-items-center rounded-2xl bg-cream transition active:scale-95", savedPick === x.id && "ring-2 ring-brand")}
                    >
                      <ScribbleView drawing={x.drawing} size={64} still />
                    </button>
                    {savedPick === x.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setSavedPick(null);
                          void removeSaved(x.id);
                        }}
                        className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white shadow-card"
                        aria-label="Delete this saved scribble"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {expanded &&
            createPortal(
              <div className="fixed inset-0 z-[60] flex flex-col bg-surface pb-safe" style={{ paddingTop: "env(safe-area-inset-top)" }} role="dialog" aria-modal="true" aria-label="Scribble, big">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 px-2 text-[18px] font-semibold">Scribble</span>
                  <Button onClick={() => void sendScribble()} loading={sending} disabled={!drawing.strokes.length} className="h-11 rounded-full px-4">
                    {sendLabel}
                  </Button>
                </div>
                {error && <p className="px-4 pb-1 text-center text-[13px] font-medium text-chili">{error}</p>}
                <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-3 pb-3">
                  <ScribblePad drawing={drawing} onChange={setDrawing} maxSize={bigSize} expanded onExpand={() => setExpanded(false)} onLive={showing ? share?.publishLive : undefined} />
                </div>
              </div>,
              document.body,
            )}
        </div>
      ) : picked ? (
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
                    <div className="mt-3">{buyButton(pack, true)}</div>
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

function ChipToggle({ on, onClick, icon, badge, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      className={clsx(
        "relative flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl px-3 text-[13.5px] font-semibold transition active:scale-[0.97]",
        on ? "bg-brand text-white" : "bg-cream text-ink-soft",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {badge && (
        <span className="absolute -top-1.5 -right-1 inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-bold text-ink-soft shadow-card ring-1 ring-line">
          {badge}
        </span>
      )}
    </button>
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
