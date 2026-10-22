"use client";

import { Gamepad2, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { gameInfo } from "@/lib/games";

/** The small result card a finished game leaves in the chat */
export function GameCard({
  m,
  myId,
  nameOf,
  onAgain,
}: {
  m: ChatMessage;
  myId: string;
  nameOf: (id: string | null) => string;
  onAgain?: (kind: string) => void;
}) {
  const meta = m.media_meta ?? {};
  const info = gameInfo(meta.kind);
  const iAmA = meta.a === myId;
  const mine = (iAmA ? meta.sa : meta.sb) ?? 0;
  const theirs = (iAmA ? meta.sb : meta.sa) ?? 0;
  const otherId = (iAmA ? meta.b : meta.a) ?? null;
  const them = nameOf(otherId);
  const tot = meta.kind === "tot";

  let headline: string;
  let sub: string | null = null;
  if (tot) {
    headline = `${Math.round(mine * 10)}% alike`;
    sub = `${mine} of 10 same picks`;
  } else if (meta.reason === "left") {
    headline = meta.by === myId ? "You left the game" : `${them} left the game`;
  } else if (meta.reason === "timeout" && !meta.winner) {
    headline = "Time ran out";
  } else if (meta.winner === myId) {
    headline = "You won";
    sub = `${mine.toLocaleString()} – ${theirs.toLocaleString()}`;
  } else if (meta.winner) {
    headline = `${them} won`;
    sub = `${theirs.toLocaleString()} – ${mine.toLocaleString()}`;
  } else {
    headline = "It's a tie";
    sub = `${mine.toLocaleString()} – ${theirs.toLocaleString()}`;
  }
  if (meta.kind === "words" && sub) sub += " points";

  return (
    <div className="my-2.5 flex justify-center animate-fade-up" data-msg={m.id}>
      <div
        className="flex w-[260px] items-center gap-3 rounded-[22px] px-3.5 py-3 text-white shadow-card"
        style={{ background: info.card, boxShadow: `0 4px 0 ${info.edge}` }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
          <Gamepad2 size={20} className="text-gold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-extrabold tracking-[0.1em] text-white/70 uppercase">{info.title}</p>
          <p className="truncate text-[15px] font-extrabold">{headline}</p>
          {sub && <p className="truncate text-[12px] text-white/75">{sub}</p>}
        </div>
        {onAgain && (
          <button
            type="button"
            onClick={() => onAgain(meta.kind ?? "tot")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 transition active:scale-95"
            aria-label="Play again"
            title="Play again"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
