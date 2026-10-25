"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { CHATS_EVENT } from "@/components/app/useMenuBadges";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sticky } from "@/components/ui/Sticky";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { intentLabel } from "@/lib/constants";
import { LiveEventChats, LiveFeedChats } from "./LiveEventChats";
import { MaskedChats } from "./MaskedChats";
import { FEATURES } from "@/lib/features";
import { isOnline, usePresence } from "@/lib/usePresence";
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
  const router = useRouter();
  const side = variant === "sidebar";
  // Unread dots stay current: fetch fresh when the list shows (going back can show an old copy),
  // and again whenever a chat is read or a message arrives
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const again = () => {
      if (wait.current) clearTimeout(wait.current);
      wait.current = setTimeout(() => router.refresh(), 700);
    };
    router.refresh();
    window.addEventListener("dp:badges", again);
    window.addEventListener(CHATS_EVENT, again);
    return () => {
      window.removeEventListener("dp:badges", again);
      window.removeEventListener(CHATS_EVENT, again);
      if (wait.current) clearTimeout(wait.current);
    };
  }, [router]);
  const { seen, now } = usePresence(matches.map((m) => m.other_id));
  const online = (id: string) => isOnline(seen[id], now);
  const [q, setQ] = useState("");
  // Masked chats count as chats: the "No chats yet" box shows only once we know there are none
  const [masked, setMasked] = useState<number | null>(null);
  const term = q.trim().toLowerCase();
  const shown = term
    ? matches.filter((m) => m.display_name.toLowerCase().includes(term) || (m.last_message ?? "").toLowerCase().includes(term))
    : matches;

  return (
    <main className={side ? "px-4 pt-7 pb-6" : "mx-auto max-w-md px-5 pt-6 lg:max-w-3xl lg:px-10 lg:pt-10"}>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Chats</h1>
          <p className="mt-1 text-[15px] text-muted">People you vibe with.</p>
        </div>
        <Link
          href="/matches/people"
          className="mb-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-soft px-3.5 text-[14px] font-semibold text-brand transition hover:bg-brand/15"
        >
          <Users size={15} /> Your people · {matches.length}
        </Link>
      </header>

      {matches.length === 0 ? (
        <>
          <MaskedChats onCount={setMasked} />
          <LiveEventChats compact={side} userId={myId} />
          {FEATURES.feed && <LiveFeedChats compact={side} userId={myId} />}
          {masked === 0 && (side ? <p className="mt-6 rounded-2xl bg-surface p-4 text-[14px] text-muted">Your chats will appear here.</p> : <Empty />)}
        </>
      ) : (
        <>
          <Sticky className="mt-3" bleed={side ? "-mx-4 px-4" : undefined}>
          <label className="flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 focus-within:border-brand">
            <Search size={17} className="shrink-0 text-muted" />
            <span className="sr-only">Search your chats</span>
            <input
              id="chats-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chats"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-ink/5">
                <X size={16} />
              </button>
            )}
          </label>
          </Sticky>

          <MaskedChats term={term} />
          <LiveEventChats compact={side} divided userId={myId} />
          {FEATURES.feed && <LiveFeedChats divided userId={myId} />}

          <section className="mt-3">
            {shown.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">No chats match “{q.trim()}”.</p>}
            <ul className="space-y-2.5">
              {shown.map((m, i) => {
                const theirTurn = !!m.last_message && m.last_sender === myId;
                const mine = m.unread ?? (!!m.last_message && m.last_sender === m.other_id);
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
                          className={clsx("absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface", online(m.other_id) ? "bg-mint" : "bg-[#b9b3c4]")}
                          aria-label={online(m.other_id) ? "Online" : "Offline"}
                          title={online(m.other_id) ? "Online" : "Offline"}
                        />
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
                            {m.display_name}
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
                          {mine && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="New messages" />}
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
      <h2 className="mt-6 text-[20px] font-semibold">No chats yet</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
        Your chats show up here: people you unmask with in Masquerade, and people you message from Meet.
      </p>
      <ButtonLink href="/meet" variant="gold" size="lg" className="mt-6" loadingText="Opening…">
        <Users size={19} /> Meet someone
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
