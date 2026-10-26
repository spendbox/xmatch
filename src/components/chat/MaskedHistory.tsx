"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { GIFTS } from "@/lib/keys";
import { voiceUrl } from "@/lib/voiceDisguise";
import { nameColor } from "@/lib/eventSpace";
import { Sheet } from "@/components/ui/Sheet";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { AudioPlayer } from "./AudioPlayer";
import { VoiceIcon } from "./VoiceIcon";
import { Masky } from "@/components/stickers/Masky";
import { stickerOf } from "@/components/stickers/StickerSheet";

type Line = { s: string | null; k: string; b: string; m: { key?: string; duration?: number; title?: string; pose?: string; color?: string } | null; t: string };
export type MaskedCardMeta = {
  aliases: Record<string, string>;
  from: string;
  started_at: string;
  count: number;
  messages: Line[];
};

const FROM: Record<string, string> = {
  masquerade: "your Masquerade pair",
  meet: "a meet",
  linkup: "Link-Up",
  wave: "a wave",
  message: "a message from Meet",
  masked: "a masked chat",
};

/**
 * A masked chat that joined this chat when you unmasked: one card ("Amaka was Purple Heron")
 * that opens the masked chat in a pop-up.
 */
export function MaskedHistoryCard({ meta, myId, theirName }: { meta: MaskedCardMeta; myId: string; theirName: string }) {
  const [open, setOpen] = useState(false);
  const theirId = Object.keys(meta.aliases ?? {}).find((id) => id !== myId) ?? "";
  const theirAlias = meta.aliases?.[theirId] ?? "Someone";
  const myAlias = meta.aliases?.[myId] ?? "You";
  const color = nameColor(theirAlias);
  const first = theirName.split(" ")[0] || theirName;
  // From a wave or a paid message you already knew who it was, so no "Amaka was Purple Heron"
  const title = meta.from === "wave" || meta.from === "message" ? "Masked chat history" : `${first} was ${theirAlias}`;

  return (
    <>
      <div className="my-3 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full max-w-[340px] items-center gap-3 rounded-[22px] border border-brand/20 bg-brand-soft px-3.5 py-3 text-left transition active:scale-[0.98]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: color }}>
            <MaskIcon className="w-7 text-white" eyes={color} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-tight font-bold text-ink">
              {title}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-muted">
              From {FROM[meta.from] ?? "a masked chat"} · {meta.count} {meta.count === 1 ? "message" : "messages"}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-brand" />
        </button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={`Your masked chat from ${FROM[meta.from] ?? "Dashpad"} · you were ${myAlias}`}
        icon={
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: color }}>
            <MaskIcon className="w-6 text-white" eyes={color} />
          </span>
        }
      >
        <div className="max-h-[60dvh] space-y-1.5 overflow-y-auto pb-2">
          {(meta.messages ?? []).length === 0 && <p className="py-8 text-center text-[14px] text-muted">You didn&apos;t get to talk in this one.</p>}
          {(meta.messages ?? []).map((l, i) => {
            const mine = l.s === myId;
            const prev = meta.messages[i - 1];
            const showName = !mine && l.s && prev?.s !== l.s;
            if (!l.s || l.k === "icebreaker" || l.k === "meet")
              return (
                <p key={i} className="mx-auto my-2 w-fit max-w-[90%] rounded-2xl bg-gold-soft px-3 py-2 text-center text-[13px] text-[#8a5a00]">
                  {l.b}
                </p>
              );
            if (l.k === "game")
              return (
                <p key={i} className="mx-auto w-fit rounded-full bg-cream px-3 py-1 text-[12px] font-semibold text-muted">
                  You played {l.b}
                </p>
              );
            const gift = l.k === "gift" ? GIFTS.find((g) => g.id === l.b) : null;
            // Only very old voice notes (from before they were kept for good) can be missing
            const voiceGone = l.k === "audio" && !l.m?.key;
            return (
              <div key={i} className={clsx("flex flex-col", mine ? "items-end" : "items-start")}>
                {showName && <span className="mb-0.5 ml-2 text-[11.5px] font-bold" style={{ color }}>{theirAlias}</span>}
                {l.k === "sticker" ? (
                  (() => {
                    const st = stickerOf(l.m, l.b);
                    return <Masky pose={st.pose} caption={st.caption} color={st.color} size={110} />;
                  })()
                ) : l.k === "gift" ? (
                  <span className="flex items-center gap-1.5 rounded-2xl bg-gold-soft px-3 py-1.5 text-[13px] font-semibold text-[#8a5a00]">
                    <GiftArt id={l.b} size={26} /> {mine ? "You sent" : "Sent you"} {gift?.name ?? "a gift"}
                  </span>
                ) : l.k === "audio" ? (
                  voiceGone ? (
                    <span className={clsx("flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13.5px] italic", mine ? "bg-brand/80 text-white" : "bg-cream text-muted")}>
                      <VoiceIcon style="normal" size={15} /> Voice note · no longer available
                    </span>
                  ) : (
                    <span className={clsx("rounded-2xl px-2 py-1", mine ? "bg-brand" : "bg-cream")}>
                      <AudioPlayer path={null} localUrl={voiceUrl(l.m?.key) ?? undefined} duration={l.m?.duration} mine={mine} seed={i + 1} />
                    </span>
                  )
                ) : (
                  <span className={clsx("max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] break-words", mine ? "bg-brand text-white" : "bg-cream text-ink")}>{l.b}</span>
                )}
              </div>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
