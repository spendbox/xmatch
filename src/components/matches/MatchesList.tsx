"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MessageCircle, Shapes } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { intentLabel } from "@/lib/constants";
import { LiveEventChats } from "./LiveEventChats";
import type { Intent, MatchSummary } from "@/lib/types";

const INTENT_TONE: Record<Intent, string> = {
  friends: "bg-brand text-white",
  dating: "bg-[#c2306b] text-white",
  spicy: "bg-chili text-white",
};

export function MatchesList({
  matches,
  myId,
  variant = "page",
}: {
  matches: MatchSummary[];
  myId: string;
  /** "sidebar" = the list beside an open chat on computers */
  variant?: "page" | "sidebar";
}) {
  const path = usePathname();
  const side = variant === "sidebar";
  const fresh = matches.filter((m) => !m.last_message || Date.now() - new Date(m.created_at).getTime() < 48 * 3600_000);
  const yourTurn = matches.filter((m) => m.last_message && m.last_sender !== myId).length;

  return (
    <main className={side ? "px-4 pt-7 pb-6" : "mx-auto max-w-md px-5 pt-6 lg:max-w-3xl lg:px-10 lg:pt-10"}>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Chats</h1>
          <p className="mt-1 text-[15px] text-muted">People you vibe with.</p>
        </div>
        {matches.length > 0 && (
          <span className="mb-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-soft px-3.5 text-[14px] font-semibold text-brand">
            <MessageCircle size={15} /> {matches.length}
          </span>
        )}
      </header>

      {matches.length === 0 ? (
        <>
          <LiveEventChats compact={side} />
          {side ? <p className="mt-6 rounded-2xl bg-surface p-4 text-[14px] text-muted">Your chats will appear here.</p> : <Empty />}
        </>
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                New reveals
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chili opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-chili" />
                </span>
              </h2>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-3 no-scrollbar">
                {fresh.map((m, i) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="relative aspect-[3/4] w-[120px] shrink-0 animate-fade-up overflow-hidden rounded-3xl bg-line shadow-card transition active:scale-[0.97]"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {m.photos?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photos[0]} alt={m.display_name} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                    <span className={clsx("absolute top-2.5 left-2.5 grid h-7 w-7 place-items-center rounded-full shadow", INTENT_TONE[m.intent])}>
                      {INTENT_ICONS[m.intent]({ size: 14, strokeWidth: 2.25 })}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <p className="truncate text-[15px] font-semibold">
                        {m.display_name}, {m.age}
                      </p>
                      {!m.last_message && <p className="text-[11px] font-medium text-white/80">Say hi 👋</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <LiveEventChats compact={side} divided />

          <section className="mt-5">
            <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold">
              Conversations
              {yourTurn > 0 && (
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[12px] font-semibold text-[#a26b00]">
                  {yourTurn} waiting on you
                </span>
              )}
            </h2>
            <ul className="space-y-2.5">
              {matches.map((m, i) => {
                const theirTurn = !!m.last_message && m.last_sender === myId;
                const mine = m.unread ?? (!!m.last_message && m.last_sender !== myId);
                return (
                  <li key={m.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <Link
                      href={`/matches/${m.id}`}
                      className={clsx(
                        "flex items-center gap-3.5 rounded-3xl border p-3 pr-4 shadow-card transition hover:border-line-strong active:scale-[0.98]",
                        path === `/matches/${m.id}` ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line bg-surface",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Avatar src={m.photos?.[0]} name={m.display_name} size={56} />
                        <span
                          className={clsx("absolute -right-0.5 -bottom-0.5 grid h-6 w-6 place-items-center rounded-full ring-2 ring-surface", INTENT_TONE[m.intent])}
                          title={intentLabel(m.intent)}
                        >
                          {INTENT_ICONS[m.intent]({ size: 12, strokeWidth: 2.5 })}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[16px] font-semibold">
                            {m.display_name}, {m.age}
                          </p>
                          <span className={clsx("shrink-0 text-[12px]", mine ? "font-semibold text-brand" : "text-muted")}>
                            {timeAgo(m.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className={clsx("min-w-0 flex-1 truncate text-[14px]", mine ? "font-medium text-ink" : "text-muted")}>
                            {m.last_message
                              ? `${theirTurn ? "You: " : ""}${m.last_message.replace(/^💬 /, "")}`
                              : "You matched! Start the conversation"}
                          </p>
                          {mine ? (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="New messages" />
                          ) : m.shared ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                              <Shapes size={11} /> {m.shared} shared
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Empty() {
  return (
    <div className="mt-8 flex animate-fade-up flex-col items-center rounded-[32px] border border-line bg-surface px-6 pt-10 pb-8 text-center shadow-card">
      <div className="relative h-32 w-44">
        <span className="absolute top-4 left-2 grid h-20 w-20 -rotate-12 animate-float place-items-center rounded-3xl bg-ink text-white shadow-lift">
          <MaskIcon className="w-12" eyes="#1c1828" />
        </span>
        <span className="absolute top-0 right-2 grid h-20 w-20 rotate-12 animate-float place-items-center rounded-3xl bg-brand text-white shadow-lift [animation-delay:-2s]">
          <MaskIcon className="w-12" eyes="#5b3fd9" />
        </span>
        <span className="absolute bottom-0 left-1/2 grid h-11 w-11 -translate-x-1/2 animate-pop place-items-center rounded-full bg-gold text-ink shadow-lift">
          <MessageCircle size={20} />
        </span>
      </div>
      <h2 className="mt-6 text-[20px] font-semibold">No matches yet</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
        Your matches show up here after you both unmask. Five good minutes is all it takes.
      </p>
      <ButtonLink href="/home" variant="gold" size="lg" className="mt-6" loadingText="Opening…">
        <MessageCircle size={19} /> Start a Masquerade
      </ButtonLink>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
