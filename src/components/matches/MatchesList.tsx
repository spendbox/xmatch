"use client";

import { chatPreview } from "@/lib/chatPreview";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { CHATS_EVENT } from "@/components/app/useMenuBadges";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IcebreakersReceived, type MyIcebreakers } from "./IcebreakersReceived";
import { PastPairs } from "@/components/home/PastPairs";
import type { PastPair } from "@/lib/hourly";
import { MessageCircle, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sticky } from "@/components/ui/Sticky";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
import { intentLabel } from "@/lib/constants";
import { LiveEventChats, LiveFeedChats } from "./LiveEventChats";
import { MaskedChatRow, maskedMatches, useMaskedChats, type MaskedChat } from "./MaskedChats";
import { usePaidChatPeople } from "@/components/masquerade/usePaidChatPeople";
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
  maskedDemo,
  renderId,
  demoPast,
  demoIce,
  initialFilter,
}: {
  /** Design previews: past pairs (the hour ran out), now a filter here instead of on Home */
  demoPast?: PastPair[];
  /** Design previews: icebreakers */
  demoIce?: MyIcebreakers;
  initialFilter?: "all" | "unread" | "ice" | "past";
  matches: MatchSummary[];
  myId: string;
  /** Sample masked chats (design preview) */
  maskedDemo?: MaskedChat[];
  /** Different on every server render: tells a fresh list from an old copy shown again (going back) */
  renderId?: string;
  /** "sidebar" = the list beside an open chat on computers */
  variant?: "page" | "sidebar";
}) {
  const path = usePathname();
  const supabase = useMemo(() => createClient(), []);
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
    // Only an old copy needs fetching again; a list that just came from the server is already fresh
    let shownBefore = true;
    try {
      const k = `dp_chats_${renderId}`;
      shownBefore = !renderId || !!sessionStorage.getItem(k);
      if (renderId) sessionStorage.setItem(k, "1");
    } catch {
      /* no storage: always fetch */
    }
    if (shownBefore) router.refresh();
    window.addEventListener("dp:badges", again);
    window.addEventListener(CHATS_EVENT, again);
    return () => {
      window.removeEventListener("dp:badges", again);
      window.removeEventListener(CHATS_EVENT, again);
      if (wait.current) clearTimeout(wait.current);
    };
  }, [router, renderId]);
  const { seen, now } = usePresence(matches.map((m) => m.other_id));
  const online = (id: string) => isOnline(seen[id], now);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "ice" | "past">(initialFilter ?? "all");
  // Icebreakers (update 106): loaded with the list, kept live; past pairs load when you open that filter
  const [ice, setIce] = useState<MyIcebreakers | null>(demoIce ?? null);
  const [past, setPast] = useState<PastPair[] | null>(demoPast ?? null);
  const loadIce = useCallback(() => {
    if (demoIce) return;
    void supabase.rpc("my_ice_breaks").then(({ data, error }) => !error && data && setIce(data as MyIcebreakers));
  }, [supabase, demoIce]);
  const loadPast = useCallback(() => {
    if (demoPast) return;
    void supabase.rpc("my_masquerade_hour").then(({ data }) => setPast(((data as { past?: PastPair[] } | null)?.past ?? []) as PastPair[]));
  }, [supabase, demoPast]);
  useEffect(() => {
    // Sent here from a notification: open Icebreakers
    if (!initialFilter && new URLSearchParams(window.location.search).get("f") === "ice") setFilter("ice");
    loadIce();
    if (demoIce) return;
    const ch = supabase
      .channel(`ice-${myId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ice_breaks", filter: `to_user=eq.${myId}` }, loadIce)
      .on("postgres_changes", { event: "*", schema: "public", table: "ice_breaks", filter: `from_user=eq.${myId}` }, loadIce)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, myId, loadIce, demoIce, initialFilter]);
  useEffect(() => {
    if (filter === "past" && past === null) loadPast();
  }, [filter, past, loadPast]);
  const term = q.trim().toLowerCase();
  // Masked chats sit in the same list as everyone else, by their latest message
  const masked = useMaskedChats(maskedDemo);
  const paid = usePaidChatPeople(!!maskedDemo);
  const unreadOf = (m: MatchSummary) => m.unread ?? (m.last_message != null && m.last_sender === m.other_id);
  const all: Item[] = [
    ...(masked ?? []).map((c) => ({ key: `s-${c.id}`, at: c.last_at, unread: c.unread, masked: c })),
    ...matches.map((m) => ({ key: m.id, at: m.last_message_at, unread: unreadOf(m), match: m })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const unreadCount = all.filter((i) => i.unread).length;
  const shown = all.filter(
    (i) =>
      (filter === "all" || (filter === "unread" && i.unread)) &&
      (i.masked
        ? maskedMatches(i.masked, paid[i.masked.id], term)
        : !term || i.match!.display_name.toLowerCase().includes(term) || (i.match!.last_message ?? "").toLowerCase().includes(term)),
  );
  // "No chats yet" only once we know there are no masked chats either
  const none = matches.length === 0 && masked !== null && masked.length === 0;

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

      {none ? (
        <>
          <LiveEventChats compact={side} userId={myId} />
          {FEATURES.feed && <LiveFeedChats compact={side} userId={myId} />}
          {side ? <p className="mt-6 rounded-2xl bg-surface p-4 text-[14px] text-muted">Your chats will appear here.</p> : <Empty />}
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
          <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 no-scrollbar" role="tablist" aria-label="Show">
            {(["all", "unread", "ice", "past"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition",
                  filter === f ? "bg-ink text-white" : "border border-line-strong bg-surface text-ink-soft hover:bg-ink/5",
                )}
              >
                {f === "all" ? "All" : f === "unread" ? "Unread" : f === "ice" ? "Icebreakers" : "Past pairs"}
                {(() => {
                  const n = f === "unread" ? unreadCount : f === "ice" ? (ice?.received.length ?? 0) : f === "past" ? (past?.length ?? 0) : 0;
                  return n > 0 ? (
                    <span className={clsx("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]", filter === f ? "bg-white text-ink" : f === "past" ? "bg-ink/10 text-ink-soft" : "bg-brand text-white")}>{n}</span>
                  ) : null;
                })()}
              </button>
            ))}
          </div>
          </Sticky>

          {filter === "ice" && (
            <section className="mt-3">
              <p className="mb-2.5 text-[13px] text-muted">People who broke the ice with you. Answer and your masked chat opens.</p>
              <IcebreakersReceived data={ice} onChanged={loadIce} demo={!!demoIce} />
            </section>
          )}
          {filter === "past" && (
            <section className="mt-1">
              {past === null ? (
                <p className="mt-3 rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">Loading…</p>
              ) : past.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">No past pairs. When an hour runs out before you both decide, the chat waits here.</p>
              ) : (
                <PastPairs pairs={past} balance={null} onChanged={loadPast} />
              )}
            </section>
          )}
          {(filter === "all" || filter === "unread") && (<>
          <LiveEventChats compact={side} divided userId={myId} />
          {FEATURES.feed && <LiveFeedChats divided userId={myId} />}

          <section className="mt-3">
            {shown.length === 0 && (
              <p className="rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">
                {term ? `No chats match “${q.trim()}”.` : filter === "unread" ? "No unread chats. You're all caught up." : "Your chats will appear here."}
              </p>
            )}
            <ul className="space-y-2.5">
              {shown.map((i) =>
                i.masked ? (
                  <MaskedChatRow key={i.key} c={i.masked} known={paid[i.masked.id]} />
                ) : (
                  <MatchRow key={i.key} m={i.match!} myId={myId} unread={i.unread} online={online(i.match!.other_id)} active={path === `/matches/${i.match!.id}`} />
                ),
              )}
            </ul>
          </section>
          </>)}
        </>
      )}
    </main>
  );
}

type Item = { key: string; at: string; unread: boolean; masked?: MaskedChat; match?: MatchSummary };

/** One chat with someone you're connected with */
function MatchRow({ m, myId, unread, online, active }: { m: MatchSummary; myId: string; unread: boolean; online: boolean; active: boolean }) {
  const theirTurn = m.last_message != null && m.last_sender === myId;
  return (
    <li className="animate-fade-up">
      <Link
        href={`/matches/${m.id}`}
        className={clsx(
          "flex items-center gap-3.5 rounded-3xl border p-3 pr-4 shadow-card transition hover:border-line-strong active:scale-[0.98]",
          active ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line bg-surface",
        )}
      >
        <span className="relative shrink-0">
          <Avatar src={m.photos?.[0]} name={m.display_name} id={m.other_id} size={56} />
          <span
            className={clsx("absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface", online ? "bg-mint" : "bg-[#b9b3c4]")}
            aria-label={online ? "Online" : "Offline"}
            title={online ? "Online" : "Offline"}
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
            <p className="truncate text-[16px] font-semibold">{m.display_name}</p>
            <span className={clsx("shrink-0 text-[12px]", unread ? "font-semibold text-brand" : "text-muted")}>{timeAgo(m.last_message_at)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className={clsx("min-w-0 flex-1 truncate text-[14px]", unread ? "font-medium text-ink" : "text-muted")}>
              {m.last_message != null ? `${theirTurn ? "You: " : ""}${chatPreview(m.last_kind, m.last_message, m.last_deleted)}` : "You matched! Start the conversation"}
            </p>
            {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="New messages" />}
          </div>
        </div>
      </Link>
    </li>
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
