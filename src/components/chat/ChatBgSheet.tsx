"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Palette } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { tapFeedback } from "@/components/ui/Button";
import { CHAT_BGS, type ChatBgId } from "@/lib/chatBackgrounds";
import { ChatBackdrop } from "./ChatBackdrop";

/** Pick a chat background: still ones and moving scenes, each shown as a little chat */
export function ChatBgSheet({
  open,
  onClose,
  value,
  onPick,
  them,
}: {
  /** Who else sees it (the background is shared in the chat) */
  them?: string;
  open: boolean;
  onClose: () => void;
  value: ChatBgId;
  onPick: (id: ChatBgId, everywhere: boolean) => void;
}) {
  const [everywhere, setEverywhere] = useState(false);
  const group = (motion: boolean) => CHAT_BGS.filter((b) => b.motion === motion);

  const tile = (id: ChatBgId, name: string) => {
    const on = id === value;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          tapFeedback();
          onPick(id, everywhere);
        }}
        aria-pressed={on}
        className="text-left"
      >
        <span className={clsx("relative block aspect-[3/4.4] overflow-hidden rounded-2xl ring-offset-2 transition", on ? "ring-[3px] ring-brand" : "ring-1 ring-line")}>
          {/* Only the picked one moves, so the list stays light */}
          <ChatBackdrop id={id} still={!on} />
          <span className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
            <span className="h-2.5 w-3/5 rounded-full bg-white shadow-sm" />
            <span className="h-2.5 w-1/2 self-end rounded-full bg-brand shadow-sm" />
            <span className="h-2.5 w-2/5 rounded-full bg-white shadow-sm" />
          </span>
          {on && (
            <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow">
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </span>
        <span className={clsx("mt-1 block truncate text-[12px] font-semibold", on ? "text-brand" : "text-ink-soft")}>{name}</span>
      </button>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Chat background"
      subtitle={them ? `It changes for you and ${them}.` : "Moving scenes pause when you leave the app."}
      icon={
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
          <Palette size={20} />
        </span>
      }
    >
      <div className="max-h-[62dvh] overflow-y-auto pb-2">
        <button
          type="button"
          role="switch"
          aria-checked={everywhere}
          onClick={() => {
            const next = !everywhere;
            setEverywhere(next);
            if (next) onPick(value, true);
          }}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-cream px-3.5 py-3 text-left text-[14px] font-semibold"
        >
          <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", everywhere ? "bg-mint" : "bg-line-strong")}>
            <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", everywhere ? "left-6" : "left-1")} />
          </span>
          Also use it for my other chats
        </button>
        <p className="mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">Moving scenes</p>
        <div className="grid grid-cols-3 gap-2.5">{group(true).map((b) => tile(b.id, b.name))}</div>
        <p className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">Still</p>
        <div className="grid grid-cols-3 gap-2.5">{group(false).map((b) => tile(b.id, b.name))}</div>
      </div>
    </Sheet>
  );
}
