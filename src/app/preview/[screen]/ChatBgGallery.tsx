"use client";

import clsx from "clsx";
import { CHAT_BGS, type ChatBgId } from "@/lib/chatBackgrounds";
import { ChatBackdrop } from "@/components/chat/ChatBackdrop";

/** Preview: every chat background as a little phone with a chat on it */
export function ChatBgGallery({ only, big }: { only?: ChatBgId[]; big?: boolean }) {
  const list = only ? CHAT_BGS.filter((b) => only.includes(b.id)) : CHAT_BGS;
  return (
    <div className="min-h-dvh bg-[#e9e5f2] p-3">
      <div className={clsx("grid gap-3", big ? "grid-cols-1" : "grid-cols-2")}>
        {list.map((b) => (
          <div key={b.id}>
            <div className={clsx("relative overflow-hidden rounded-[22px] shadow-lg ring-1 ring-black/10", big ? "h-[640px]" : "h-[320px]")}>
              <ChatBackdrop id={b.id} />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center gap-2 bg-white/95 px-3 py-2 shadow-sm">
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#e5484d] to-[#f2b33d]" />
                  <span className="text-[12px] font-bold text-ink">Amaka</span>
                </div>
                <div className={clsx("flex flex-1 flex-col justify-end gap-1.5 p-2.5", big ? "text-[15px]" : "text-[11.5px]")}>
                  <span className="mx-auto mb-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-muted shadow-sm">Today</span>
                  <span className="max-w-[78%] self-start rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-ink shadow-sm">Hey! How was your day? 😊</span>
                  <span className="max-w-[78%] self-end rounded-2xl rounded-br-md bg-brand px-2.5 py-1.5 text-white shadow-sm">Long, but better now</span>
                  <span className="max-w-[78%] self-start rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-ink shadow-sm">Beach this weekend?</span>
                  <span className="max-w-[78%] self-end rounded-2xl rounded-br-md bg-brand px-2.5 py-1.5 text-white shadow-sm">Say less 🌊</span>
                </div>
                <div className="m-2 mt-0 rounded-full bg-white/95 px-3 py-1.5 text-[10.5px] text-muted shadow-sm">Message Amaka</div>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[12.5px] font-bold text-ink">
              {b.name} <span className="font-semibold text-muted">· {b.motion ? "moving" : "still"}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
