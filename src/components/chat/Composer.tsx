"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Gift, Hourglass, Images, Mic, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { MAX_MEDIA_BYTES, formatDuration } from "@/lib/chatMedia";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { snippet } from "./MessageList";
import { useVoiceRecorder } from "./useVoiceRecorder";

export type MediaKind = "image" | "video";

const TIP_KEY = "dp_plus_tip";
const TIP_TIMES = 3;

/** Something in the + menu beside the message box (a game, an icebreaker…) */
export type ComposerAction = { key: string; label: string; icon: React.ReactNode; tone: string; onClick: () => void; badge?: string };

type Props = {
  onSend: (text: string) => Promise<void> | void;
  /** Turn on photo/video sending */
  onSendMedia?: (file: File, kind: MediaKind, caption: string, slow: boolean) => Promise<void> | void;
  /** Turn on voice notes */
  onSendVoice?: (blob: Blob, seconds: number) => Promise<void> | void;
  replyTo?: ChatMessage | null;
  replyName?: string;
  onCancelReply?: () => void;
  onGift?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Extra things in the + menu, so the message box keeps its room */
  actions?: ComposerAction[];
  /** A dot on the + button (e.g. a game is waiting) */
  plusDot?: boolean;
  /** Put this in the message box (a suggested opener); change `key` to put it in again */
  draft?: { text: string; key: number } | null;
  /** Hold back the "Tap + for more" tip (something else is showing above the box) */
  noTip?: boolean;
};

export function Composer({
  onSend,
  onSendMedia,
  onSendVoice,
  replyTo,
  replyName,
  onCancelReply,
  onGift,
  disabled,
  placeholder = "Say something…",
  actions = [],
  plusDot,
  draft,
  noTip,
}: Props) {
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [picked, setPicked] = useState<{ file: File; url: string; kind: MediaKind } | null>(null);
  const [caption, setCaption] = useState("");
  const [slow, setSlow] = useState(false);
  const [sending, setSending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const hasText = text.trim().length > 0;
  // A suggested opener was picked: put it in the box, ready to edit or send
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(draft.text.length, draft.text.length);
    });
  }, [draft]);
  const hasPlus = !!(onSendMedia || onGift || actions.length > 0);

  // Someone's first 3 chats: a little tip pointing at the + (gone once they've tapped it)
  const [tip, setTip] = useState(false);
  const tipDone = useRef(false);
  useEffect(() => {
    // Wait while ideas to say are showing above the box (they'd overlap); once per chat
    if (!hasPlus || !actions.length || noTip || tipDone.current) return;
    tipDone.current = true;
    try {
      const n = Number(localStorage.getItem(TIP_KEY) ?? "0");
      if (n >= TIP_TIMES) return;
      localStorage.setItem(TIP_KEY, String(n + 1));
      const t = setTimeout(() => setTip(true), 900);
      return () => clearTimeout(t);
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noTip]);
  function plusSeen() {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, String(TIP_TIMES));
    } catch {
      /* private mode */
    }
  }

  // Grow the box with the message, up to 5 lines
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }, [text]);

  useEffect(() => {
    if (replyTo) area.current?.focus();
  }, [replyTo]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!hasText || disabled) return;
    const t = text.trim();
    setText("");
    tapFeedback();
    await onSend(t);
  }

  function choose(files: FileList | null) {
    setAttachOpen(false);
    setFileError(null);
    const file = files?.[0];
    if (!file) return;
    const kind: MediaKind | null = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!kind) return setFileError("You can send photos and videos.");
    if (file.size > MAX_MEDIA_BYTES) return setFileError("That file is over 50 MB. Try a shorter video.");
    setCaption("");
    setSlow(false);
    setPicked({ file, kind, url: URL.createObjectURL(file) });
  }

  async function sendPicked() {
    if (!picked || !onSendMedia) return;
    setSending(true);
    const p = picked;
    const c = caption.trim();
    setPicked(null);
    setSending(false);
    await onSendMedia(p.file, p.kind, c, slow);
  }

  async function finishVoice() {
    const out = await voice.stop();
    if (out && out.seconds >= 1 && onSendVoice) {
      tapFeedback();
      await onSendVoice(out.blob, out.seconds);
    }
  }

  return (
    <div className="border-t border-line bg-surface pb-safe">
      {replyTo && (
        <div className="flex animate-fade-up items-center gap-3 px-4 pt-3">
          <div className="min-w-0 flex-1 rounded-xl border-l-[3px] border-brand bg-brand-soft/70 px-3 py-1.5">
            <p className="text-[12px] font-semibold text-brand">Replying to {replyName}</p>
            <p className="truncate text-[13px] text-muted">{snippet(replyTo)}</p>
          </div>
          <button type="button" onClick={onCancelReply} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Cancel reply">
            <X size={18} />
          </button>
        </div>
      )}
      {(fileError || voice.error) && <p className="px-4 pt-2 text-[13px] font-medium text-chili">{fileError ?? voice.error}</p>}

      {voice.recording ? (
        <div className="flex items-center gap-2 px-3 pt-3">
          <button type="button" onClick={voice.cancel} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-chili hover:bg-chili-soft" aria-label="Delete recording">
            <Trash2 size={21} />
          </button>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-chili-soft/60 px-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-chili" />
            <span className="text-[15px] font-semibold tabular-nums text-chili">{formatDuration(voice.seconds)}</span>
            <div className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-chili/70 transition-[height] duration-100"
                  style={{ height: `${20 + Math.min(80, voice.level * 100 * (0.5 + ((i * 37) % 10) / 10))}%` }}
                />
              ))}
            </div>
          </div>
          <button type="button" onClick={finishVoice} className="grid h-12 w-12 shrink-0 animate-pop place-items-center rounded-full bg-brand text-white" aria-label="Send voice note">
            <SendHorizontal size={20} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="px-3 pt-2.5 pb-1">
          <div className="flex items-end gap-1 rounded-[26px] border border-line bg-cream p-1 transition focus-within:border-brand/40 focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(91_63_217/0.08)]">
          {hasPlus && (
            <span className="relative shrink-0">
            {tip && (
              <button
                type="button"
                onClick={plusSeen}
                className="absolute bottom-[calc(100%+12px)] left-0 z-20 w-[230px] animate-pop rounded-2xl bg-ink px-3.5 py-2.5 text-left text-[13px] leading-snug text-white shadow-lift"
              >
                <b className="block text-[14px]">Tap + for more 🎮</b>
                Games, gifts{actions.some((a) => a.key === "ice") ? ", icebreakers" : ""} and more live here.
                <span className="mt-1 block text-[11px] font-semibold text-white/60">Got it</span>
                <span aria-hidden className="absolute -bottom-1.5 left-[18px] h-3 w-3 rotate-45 bg-ink" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                plusSeen();
                setAttachOpen(true);
              }}
              disabled={disabled}
              className={clsx(
                "relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-50",
                attachOpen ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-[0_1px_3px_rgb(28_24_40/0.12)]",
              )}
              aria-label="More: games, gifts and more"
              aria-expanded={attachOpen}
            >
              <Plus size={22} className={clsx("transition-transform duration-200", attachOpen && "rotate-45")} />
              {plusDot && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-surface" />}
              {tip && <span aria-hidden className="absolute inset-0 animate-ping rounded-full ring-2 ring-brand" />}
            </button>
            </span>
          )}
          <textarea
            ref={area}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={2000}
            enterKeyHint="send"
            className="no-scrollbar max-h-[132px] min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-[9px] text-[16px] leading-[22px] outline-none placeholder:text-muted disabled:opacity-60"
            aria-label="Message"
          />
          {hasText || !onSendVoice ? (
            <button
              type="submit"
              disabled={!hasText || disabled}
              aria-label="Send"
              className={clsx(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95",
                hasText ? "animate-pop bg-brand text-white shadow-[0_6px_16px_-6px_rgb(91_63_217/0.7)]" : "bg-line text-muted",
              )}
            >
              <SendHorizontal size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                voice.start();
              }}
              disabled={disabled}
              aria-label="Record a voice note"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-50"
            >
              <Mic size={19} />
            </button>
          )}
          </div>
        </form>
      )}

      <input ref={gallery} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />

      <Sheet open={attachOpen} onClose={() => setAttachOpen(false)} title="More">
        <div className="grid grid-cols-3 gap-2.5 pb-2">
          {actions.map((a) => (
            <AttachTile
              key={a.key}
              icon={a.icon}
              label={a.label}
              tone={a.tone}
              badge={a.badge}
              onClick={() => {
                setAttachOpen(false);
                a.onClick();
              }}
            />
          ))}
          {onSendMedia && (
            <>
              <AttachTile icon={<Images size={24} strokeWidth={1.75} />} label="Photo & video" tone="bg-brand-soft text-brand" onClick={() => gallery.current?.click()} />
              <AttachTile icon={<Camera size={24} strokeWidth={1.75} />} label="Camera" tone="bg-mint-soft text-mint" onClick={() => camera.current?.click()} />
            </>
          )}
          {onGift && (
            <AttachTile
              icon={<Gift size={24} strokeWidth={1.75} />}
              label="Gift"
              tone="bg-chili-soft text-chili"
              onClick={() => {
                setAttachOpen(false);
                onGift();
              }}
            />
          )}
        </div>
      </Sheet>

      <Sheet
        open={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.kind === "video" ? "Send video" : "Send photo"}
        footer={
          <div className="flex items-end gap-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              maxLength={500}
              className="h-12 min-w-0 flex-1 rounded-full border border-line bg-cream px-5 text-[16px] outline-none focus:border-brand"
            />
            <Button onClick={sendPicked} loading={sending} className="h-12 w-12 shrink-0 rounded-full p-0" aria-label="Send">
              <SendHorizontal size={20} />
            </Button>
          </div>
        }
      >
        {picked && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-ink">
              {picked.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.url} alt="Preview" className={clsx("max-h-[44dvh] w-full object-contain transition duration-300", slow && "scale-110 blur-xl")} />
              ) : (
                <video src={picked.url} controls={!slow} playsInline className={clsx("max-h-[44dvh] w-full transition duration-300", slow && "scale-110 blur-xl")} />
              )}
              {slow && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-semibold text-white backdrop-blur">
                    <Hourglass size={15} /> How they&apos;ll see it at first
                  </span>
                </span>
              )}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-cream px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-soft text-[#9a6a0c]">
                <Hourglass size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Slow reveal</span>
                <span className="block text-[12.5px] leading-snug text-muted">Starts blurred and clears a little with every message you swap</span>
              </span>
              <Toggle checked={slow} onChange={setSlow} label="Slow reveal" />
            </label>
          </>
        )}
      </Sheet>
    </div>
  );
}

function AttachTile({ icon, label, tone, onClick, badge }: { icon: React.ReactNode; label: string; tone: string; onClick: () => void; badge?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        onClick();
      }}
      className="relative flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-4 transition active:scale-95"
    >
      {badge && <span className="absolute top-2 right-2 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-[#8a5a00] uppercase">{badge}</span>}
      <span className={"grid h-12 w-12 place-items-center rounded-2xl " + tone}>{icon}</span>
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  );
}
