"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

export function MessageList({ messages, myId, footer }: { messages: ChatMessage[]; myId: string; footer?: React.ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {messages.map((m, i) => {
        if (m.kind === "icebreaker" || (!m.sender_id && m.body)) {
          return (
            <div key={m.id} className="my-2 flex justify-center animate-fade-up">
              <div className="max-w-[88%] rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3 text-center">
                <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-[#9a6a0c] uppercase">
                  <Sparkles size={12} /> Icebreaker
                </p>
                <p className="text-[15px] font-medium leading-snug text-ink">{m.body.replace(/^💬 /, "")}</p>
              </div>
            </div>
          );
        }
        const mine = m.sender_id === myId;
        const prev = messages[i - 1];
        const grouped = prev && prev.sender_id === m.sender_id;
        return (
          <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start", !grouped && "mt-1")}>
            <p
              className={clsx(
                "max-w-[78%] px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap",
                mine
                  ? "rounded-[20px] rounded-br-md bg-brand text-white"
                  : "rounded-[20px] rounded-bl-md bg-surface text-ink shadow-card",
              )}
            >
              {m.body}
            </p>
          </div>
        );
      })}
      {footer}
      <div ref={end} />
    </div>
  );
}
