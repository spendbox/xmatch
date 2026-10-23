"use client";

import { sexLabel } from "@/lib/eventSpace";
import Link from "next/link";
import clsx from "clsx";
import { Check, Clock3, Handshake, MessageCircle, X } from "lucide-react";
import type { EventChatSummary } from "@/lib/events";
import { Spinner } from "@/components/ui/Button";
import { BlurPhoto } from "./common";

/** Your private chats at an event. After it ends, choose who to keep. */
export function ChatsPanel({
  eventId,
  userId,
  chats,
  unread,
  maxChats,
  phase,
  decideBy,
  matchIds,
  deciding,
  onVote,
  className,
}: {
  eventId: string;
  userId: string;
  chats: EventChatSummary[] | null;
  unread: Record<string, number>;
  maxChats: number;
  phase: "upcoming" | "live" | "ended" | "cancelled";
  /** Last moment to keep or let go (an hour after the end) */
  decideBy: number;
  matchIds: Record<string, string>;
  deciding: string | null;
  onVote: (c: EventChatSummary, keep: boolean) => void;
  className?: string;
}) {
  const ended = phase === "ended";
  const canDecide = ended && Date.now() < decideBy;
  const started = (chats ?? []).filter((c) => c.opened_by === userId && c.status === "open").length;
  const byTime = new Date(decideBy).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <section className={clsx("rounded-3xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Your chats</h2>
        {!ended && chats && (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-muted tabular-nums">
            {started} of {maxChats} started
          </span>
        )}
      </div>

      {ended && (chats?.length ?? 0) > 0 && (
        <div className={clsx("mt-3 rounded-2xl px-4 py-3 text-[13px] leading-snug", canDecide ? "bg-brand-soft text-brand-ink" : "bg-cream text-muted")}>
          {canDecide ? (
            <>
              <p className="font-semibold">Keep the chats you&apos;d like to continue</p>
              <p className="mt-0.5">If you both keep a chat, you're connected and it moves to your Chats. Decide by {byTime}.</p>
            </>
          ) : (
            <p>Choices are closed. Chats you both kept are in your Chats.</p>
          )}
        </div>
      )}

      {chats === null ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-line/50" />
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center">
          <MessageCircle size={22} className="mx-auto text-brand" />
          <p className="mt-2 text-[14px] font-semibold">No chats yet</p>
          <p className="mt-0.5 text-[13px] text-muted">{ended ? "This event has ended." : "Tap someone on the Wall and say hi."}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {chats.map((c) => {
            const matchId = matchIds[c.id];
            const href = c.status === "matched" && matchId ? `/matches/${matchId}` : `/events/${eventId}/chat/${c.id}`;
            const count = unread[c.id] ?? 0;
            const last = c.last_message ? `${c.last_sender === userId ? "You: " : ""}${c.last_message}` : c.opened_by === userId ? "You said hi" : "Said hi to you";
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-surface">
                <Link href={href} className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-cream">
                  <BlurPhoto blur={c.blur} photo={c.photo} alt={c.name} soft className="h-12 w-12 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <span className="truncate">
                        {c.name || "Someone"}
                        {sexLabel(c.gender) && <span className="font-normal text-muted"> · {sexLabel(c.gender)}</span>}
                      </span>
                    </p>
                    <p className={clsx("truncate text-[13px]", count ? "font-semibold text-ink" : "text-muted")}>{last}</p>
                  </div>
                  <Status c={c} count={count} />
                </Link>
                {canDecide && c.status === "open" && c.my_keep === null && (
                  <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5">
                    <button
                      onClick={() => onVote(c, false)}
                      disabled={deciding === c.id}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px] font-semibold text-ink-soft transition hover:bg-cream active:scale-[0.98] disabled:opacity-50"
                    >
                      <X size={16} /> Let go
                    </button>
                    <button
                      onClick={() => onVote(c, true)}
                      disabled={deciding === c.id}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand text-[14px] font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50"
                    >
                      {deciding === c.id ? <Spinner /> : <Handshake size={16} />} Keep
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Status({ c, count }: { c: EventChatSummary; count: number }) {
  if (c.status === "matched")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-[12px] font-semibold text-mint">
        <Handshake size={13} /> Connected
      </span>
    );
  if (count > 0)
    return <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-white">{count}</span>;
  if (c.my_keep === true)
    return (
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-semibold text-brand-ink">
          <Check size={13} /> Kept
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Clock3 size={11} /> Waiting for them
        </span>
      </span>
    );
  return null;
}
