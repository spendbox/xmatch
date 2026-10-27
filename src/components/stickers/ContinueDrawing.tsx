"use client";

import { ChevronRight } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

/** The drawing you're doing together in this chat, if one is still open (from its card in the chat) */
export function openDrawing(messages: ChatMessage[]): string | null {
  for (let n = messages.length - 1; n >= 0; n--) {
    const m = messages[n];
    if (m.kind !== "draw") continue;
    const meta = m.media_meta as { draw?: string; status?: string } | null;
    return meta?.status === "open" && meta.draw ? meta.draw : null;
  }
  return null;
}

/** Above the message box: go back to the drawing any time */
export function ContinueDrawing({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-3 mb-1.5 flex w-[calc(100%-1.5rem)] animate-fade-up items-center gap-2.5 rounded-2xl border border-brand/15 bg-brand-soft px-3.5 py-2.5 text-left transition active:scale-[0.98] lg:mx-auto lg:max-w-3xl"
    >
      <span className="text-[18px] leading-none">🎨</span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">Your drawing with {name}</span>
      <span className="inline-flex items-center text-[13.5px] font-semibold text-brand">
        Continue <ChevronRight size={16} />
      </span>
    </button>
  );
}
