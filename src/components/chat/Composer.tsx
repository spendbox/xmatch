"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";
import clsx from "clsx";

export function Composer({
  onSend,
  disabled,
  placeholder = "Say something…",
  leading,
}: {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  leading?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const can = text.trim().length > 0 && !disabled;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!can) return;
    const t = text.trim();
    setText("");
    await onSend(t);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-line bg-surface px-3 pt-3 pb-safe">
      {leading}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={1000}
        enterKeyHint="send"
        className="h-12 min-w-0 flex-1 rounded-full border border-line bg-cream px-5 text-[16px] outline-none focus:border-brand disabled:opacity-60"
        aria-label="Message"
      />
      <button
        type="submit"
        disabled={!can}
        aria-label="Send"
        className={clsx(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full transition",
          can ? "bg-brand text-white" : "bg-line text-muted",
        )}
      >
        <SendHorizontal size={20} />
      </button>
    </form>
  );
}
