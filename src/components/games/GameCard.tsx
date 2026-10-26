"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, Gamepad2, Reply, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { gameInfo } from "@/lib/games";

type TruthsDetail = {
  lines_a?: string[];
  lines_b?: string[];
  lie_a?: number;
  lie_b?: number;
  guess_a?: number;
  guess_b?: number;
};
type TotDetail = { qs: { q: string; a: string; b: string }[]; picks: (("a" | "b" | null)[])[] };

/** The result card a finished game leaves in the chat, with the answers for Two Truths and This or That */
export function GameCard({
  m,
  myId,
  nameOf,
  onAgain,
  onReply,
}: {
  m: ChatMessage;
  myId: string;
  nameOf: (id: string | null) => string;
  onAgain?: (kind: string) => void;
  /** Reply in the chat about this card (with the line you tapped) */
  onReply?: (m: ChatMessage) => void;
}) {
  const meta = (m.media_meta ?? {}) as NonNullable<ChatMessage["media_meta"]> & { detail?: TruthsDetail | TotDetail };
  const info = gameInfo(meta.kind);
  const iAmA = meta.a === myId;
  const mine = (iAmA ? meta.sa : meta.sb) ?? 0;
  const theirs = (iAmA ? meta.sb : meta.sa) ?? 0;
  const otherId = (iAmA ? meta.b : meta.a) ?? null;
  const them = nameOf(otherId);
  const tot = meta.kind === "tot";
  const totDetail = tot ? (meta.detail as TotDetail | undefined) : undefined;
  const truths = meta.kind === "truths" ? (meta.detail as TruthsDetail | undefined) : undefined;
  const total = totDetail?.qs?.length || 10;

  let headline: string;
  let sub: string | null = null;
  if (tot) {
    const same = totDetail?.picks?.length ? totDetail.picks.filter((p) => p[0] && p[0] === p[1]).length : mine;
    headline = `${Math.round((same * 100) / total)}% alike`;
    sub = `${same} of ${total} same picks`;
  } else if (meta.reason === "left") {
    headline = meta.by === myId ? "You left the game" : `${them} left the game`;
  } else if (meta.reason === "timeout" && !meta.winner) {
    headline = "Time ran out";
  } else if (meta.status === "cancelled" && !meta.winner) {
    // Ended before anyone won (or before it really started)
    headline = "Game ended early";
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

  const replyAbout = onReply ? (text: string) => onReply({ ...m, body: text }) : undefined;
  const hasDetail = !!(truths?.lines_a?.length || totDetail?.qs?.length);

  return (
    <div className="my-2.5 flex justify-center animate-fade-up" data-msg={m.id}>
      <div
        className={clsx("overflow-hidden rounded-[22px] text-white shadow-card", hasDetail ? "w-[min(340px,90%)]" : "w-[260px]")}
        style={{ background: info.card, boxShadow: `0 4px 0 ${info.edge}` }}
      >
        <div className="flex items-center gap-3 px-3.5 py-3">
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
        {truths && <TruthsAnswers d={truths} iAmA={iAmA} them={them} onReply={replyAbout} />}
        {totDetail && <TotAnswers d={totDetail} iAmA={iAmA} them={them} onReply={replyAbout} />}
      </div>
    </div>
  );
}

function TruthsAnswers({ d, iAmA, them, onReply }: { d: TruthsDetail; iAmA: boolean; them: string; onReply?: (t: string) => void }) {
  const [tab, setTab] = useState<"theirs" | "mine">("theirs");
  const theirLines = (iAmA ? d.lines_b : d.lines_a) ?? [];
  const myLines = (iAmA ? d.lines_a : d.lines_b) ?? [];
  if (!theirLines.length && !myLines.length) return null;
  const lines = tab === "theirs" ? theirLines : myLines;
  const lie = tab === "theirs" ? (iAmA ? d.lie_b : d.lie_a) : iAmA ? d.lie_a : d.lie_b;
  const guess = tab === "theirs" ? (iAmA ? d.guess_a : d.guess_b) : iAmA ? d.guess_b : d.guess_a;
  const guesser = tab === "theirs" ? "You" : them;
  const right = guess !== undefined && guess === lie;

  return (
    <div className="bg-black/20 px-3 pt-2.5 pb-3">
      <div className="flex rounded-full bg-white/10 p-0.5">
        {(["theirs", "mine"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx("h-7 flex-1 truncate rounded-full px-2 text-[12px] font-bold transition", tab === t ? "bg-white text-[#2b1d73]" : "text-white/75")}
          >
            {t === "theirs" ? `${them}'s` : "Yours"}
          </button>
        ))}
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {lines.map((l, k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => onReply?.(l)}
              disabled={!onReply}
              className={clsx(
                "group flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] leading-snug",
                k === lie ? "bg-white text-ink" : "bg-white/12 text-white",
              )}
            >
              <span className="min-w-0 flex-1">{l}</span>
              {k === lie && <span className="shrink-0 rounded-md bg-chili px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">LIE</span>}
              {k === guess && k !== lie && (
                <span className="shrink-0 rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-white">{guesser === "You" ? "your guess" : "their guess"}</span>
              )}
              {onReply && <Reply size={13} className={clsx("mt-0.5 shrink-0 opacity-50", k === lie ? "text-ink" : "text-white")} />}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] font-semibold text-white/80">
        {guess === undefined ? `${guesser === "You" ? "You" : them} didn't guess` : right ? `${guesser} caught it ✓` : `${guesser} got fooled`}
      </p>
    </div>
  );
}

function TotAnswers({ d, iAmA, them, onReply }: { d: TotDetail; iAmA: boolean; them: string; onReply?: (t: string) => void }) {
  const [all, setAll] = useState(false);
  const rows = d.qs.map((q, i) => {
    const p = d.picks[i] ?? [null, null];
    const me = iAmA ? p[0] : p[1];
    const they = iAmA ? p[1] : p[0];
    return { ...q, me: me ? q[me] : null, they: they ? q[they] : null, same: !!me && me === they };
  });
  // Different picks first: they make the best conversation starters
  const sorted = [...rows.filter((r) => !r.same), ...rows.filter((r) => r.same)];
  const shown = all ? sorted : sorted.slice(0, 3);

  return (
    <div className="bg-black/20 px-3 pt-2.5 pb-3">
      <ul className="flex flex-col gap-1.5">
        {shown.map((r, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onReply?.(`${r.q} ${r.a} or ${r.b}?`)}
              disabled={!onReply}
              className="flex w-full items-start gap-2 rounded-xl bg-white/12 px-2.5 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-white/70">{r.q}</span>
                {r.same ? (
                  <span className="mt-0.5 block text-[13px] font-bold">
                    <span className="mr-1.5 rounded-md bg-[#7dffb5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0b3a2a]">BOTH</span>
                    {r.me}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[13px] leading-snug">
                    <b>You:</b> {r.me ?? "no pick"} <span className="text-white/50">·</span> <b>{them}:</b> {r.they ?? "no pick"}
                  </span>
                )}
              </span>
              {onReply && <Reply size={13} className="mt-1 shrink-0 opacity-50" />}
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > 3 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-white/85">
          {all ? "Show less" : `Show all ${sorted.length}`}
          <ChevronDown size={14} className={clsx("transition", all && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
