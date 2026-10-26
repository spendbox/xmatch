"use client";

import { chatPreview } from "@/lib/chatPreview";
import { Photo } from "@/components/ui/Photo";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CHATS_EVENT } from "@/components/app/useMenuBadges";
import { createClient } from "@/lib/supabase/client";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { nameColor } from "@/lib/eventSpace";
import { GoldStar } from "@/components/pacts/PactReveal";
import { usePaidChatPeople, type PaidChatPerson } from "@/components/masquerade/usePaidChatPeople";

export type MaskedChat = {
  id: string;
  alias: string;
  my_alias: string;
  from_meet: boolean;
  /** Your live Masquerade pair, and when it ends */
  live_pair?: boolean;
  ends_at?: string | null;
  /** The pact this chat came from, and whether you've revealed your match yet */
  pact?: string | null;
  pact_slug?: string | null;
  pact_seen?: boolean;
  my_vote: boolean | null;
  they_unmasked: boolean;
  /** They're in the app right now (update 89) */
  online?: boolean;
  last_message: string | null;
  /** What the last message was (update 91) */
  last_kind?: string | null;
  last_mine: boolean | null;
  last_at: string;
  unread: boolean;
};

/** Masked chats with no time limit (started from Meet, or reopened) and your live pair. Null until loaded. */
export function useMaskedChats(demo?: MaskedChat[]) {
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState<MaskedChat[] | null>(demo ?? null);

  useEffect(() => {
    if (demo) return;
    const load = () =>
      supabase.rpc("my_masked_chats").then(({ data, error }) => {
        if (!error) setChats(Array.isArray(data) ? (data as MaskedChat[]) : []);
      });
    load();
    // A chat was read (or a message arrived): refresh the unread dots
    let t: ReturnType<typeof setTimeout> | null = null;
    const again = () => {
      if (t) clearTimeout(t);
      t = setTimeout(load, 700);
    };
    // Who's online stays current, like everywhere else (every 30 seconds, and when you come back)
    const tick = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    const onShow = () => document.visibilityState === "visible" && load();
    window.addEventListener("dp:badges", again);
    window.addEventListener(CHATS_EVENT, again);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("dp:badges", again);
      window.removeEventListener(CHATS_EVENT, again);
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(tick);
      if (t) clearTimeout(t);
    };
  }, [supabase, demo]);

  return chats;
}

/** Whether a masked chat matches a search */
export function maskedMatches(c: MaskedChat, known: PaidChatPerson | undefined, term: string) {
  return !term || c.alias.toLowerCase().includes(term) || (known?.name ?? "").toLowerCase().includes(term) || (c.last_message ?? "").toLowerCase().includes(term);
}

/** Chats: one masked chat. You're both masked until you both unmask. */
export function MaskedChatRow({ c, known }: { c: MaskedChat; known?: PaidChatPerson }) {
  // Started by paying on Meet, or you both waved: you saw their name and main photo there, so they show here
  const name = known?.name || c.alias;
  return c.pact && c.pact_slug && !c.pact_seen ? (
    // A pact match you haven't revealed yet: no name, just the teaser
    <li>
      <Link href={`/link/${c.pact_slug}`} className="flex items-center gap-3.5 rounded-3xl border border-[#f2c45a]/60 bg-surface p-3 pr-4 shadow-card transition active:scale-[0.98]">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #e5484d, #f2b33d)" }}>
          <MaskIcon className="w-8 text-white blur-[2px]" eyes="#e5484d" />
          <GoldStar size={20} className="absolute -top-0.5 -right-0.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">Your {c.pact} match</span>
          <span className="mt-0.5 block truncate text-[14px] font-medium text-brand">Tap to reveal who it is</span>
        </span>
      </Link>
    </li>
  ) : (
    <li>
      <Link
        href={`/masquerade/${c.id}`}
        className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-3 pr-4 shadow-card transition hover:border-line-strong active:scale-[0.98]"
      >
        <span className="relative shrink-0">
          <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full" style={{ background: nameColor(c.alias) }}>
            {known?.photo ? (
              <Photo src={known.photo} id={known.id} className="h-full w-full object-cover" />
            ) : (
              <MaskIcon className="w-8 text-white" eyes={nameColor(c.alias)} />
            )}
          </span>
          {c.pact ? (
            <GoldStar size={20} className="absolute -top-0.5 -right-0.5" />
          ) : (
            c.online !== undefined && (
              <span
                className={clsx("absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface", c.online ? "bg-mint" : "bg-[#b9b3c4]")}
                aria-label={c.online ? "Online" : "Offline"}
                title={c.online ? "Online" : "Offline"}
              />
            )
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[16px] font-semibold">{name}</span>
            <span className={clsx("shrink-0 text-[12px]", c.unread ? "font-semibold text-brand" : "text-muted")}>{ago(c.last_at)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={clsx("min-w-0 flex-1 truncate text-[14px]", c.unread ? "font-medium text-ink" : "text-muted")}>
              {c.they_unmasked && c.my_vote !== true
                ? `${name} unmasked · your move`
                : c.last_message != null
                  ? `${c.last_mine ? "You: " : ""}${chatPreview(c.last_kind, c.last_message)}`
                  : c.pact
                    ? `${c.pact} match · say hi`
                    : c.live_pair
                      ? "Your Masquerade pair · say hi"
                      : c.from_meet
                        ? "Started from Meet · say hi"
                        : "Reopened · say hi"}
            </span>
            {c.unread ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="New messages" />
            ) : c.live_pair && c.ends_at ? (
              // Live pair: how long is left
              <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">{left(c.ends_at)}</span>
            ) : (
              <span className="shrink-0 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-soft">Masked</span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Masked chats on their own (Chats mixes them in with your other chats) */
export function MaskedChats({ demo }: { demo?: MaskedChat[] }) {
  const chats = useMaskedChats(demo);
  const paid = usePaidChatPeople(!!demo);
  if (!chats?.length) return null;
  return (
    <ul className="mt-4 space-y-2.5">
      {chats.map((c) => (
        <MaskedChatRow key={c.id} c={c} known={paid[c.id]} />
      ))}
    </ul>
  );
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** "42m left" */
function left(iso: string) {
  const m = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
}
