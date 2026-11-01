"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHATS_EVENT } from "@/components/app/useMenuBadges";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { nameColor } from "@/lib/eventSpace";
import type { Intent, MatchSummary } from "@/lib/types";
import clsx from "clsx";
import { tapFeedback } from "@/components/ui/Button";
import { NoteSheet } from "./NoteSheet";
import { Avatar } from "@/components/ui/Avatar";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { usePaidChatPeople } from "@/components/masquerade/usePaidChatPeople";

/** A masked chat, as the Chats page lists it */
export type RecentMasked = {
  id: string;
  alias: string;
  pact_slug?: string | null;
  pact_seen?: boolean;
  last_message: string | null;
  last_mine: boolean | null;
  last_at: string;
  unread: boolean;
};

type Item = { key: string; href: string; at: string; label: string; unread: boolean; waiting: boolean; photo?: string | null; name?: string; mask?: string; note?: string | null };

/** A note in a bubble above someone's circle (like Instagram Notes) */
function NoteBubble({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span
      className={clsx(
        "absolute -top-[42px] left-1/2 z-10 w-[84px] -translate-x-1/2 rounded-2xl px-2 py-1 text-center text-[10.5px] leading-tight font-medium shadow-[0_6px_14px_-8px_rgba(28,24,40,0.5)] ring-1 ring-line",
        muted ? "bg-cream text-muted" : "bg-surface text-ink",
      )}
    >
      <span className="line-clamp-2 break-words">{text}</span>
      <span aria-hidden className="absolute -bottom-1 left-6 h-2.5 w-2.5 rounded-full bg-inherit ring-1 ring-line" />
    </span>
  );
}

const fresh = (at?: string | null) => !!at && Date.now() - new Date(at).getTime() < 24 * 3_600_000;

/**
 * Home: your latest chats (connected and masked) as small circles, no names.
 * Red dot and ring: a new message you haven't read. Small dark dot: you've read it but not replied.
 */
export function RecentChats({
  matches,
  myId,
  demoMasked,
  lead,
  me,
}: {
  matches: MatchSummary[];
  myId: string;
  demoMasked?: RecentMasked[];
  /** First in the row (who viewed you) */
  lead?: React.ReactNode;
  /** You: your photo and note (first in the row; tap to write a note) */
  me?: { photo?: string | null; note?: string | null; noteAt?: string | null; intent: Intent; demo?: boolean };
}) {
  const [myNote, setMyNote] = useState<{ note: string | null; at: string | null }>({ note: me?.note ?? null, at: me?.noteAt ?? null });
  const [noteOpen, setNoteOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [masked, setMasked] = useState<RecentMasked[]>(demoMasked ?? []);
  const paid = usePaidChatPeople(!!demoMasked);

  // Live: a new message in any of your chats refreshes this row (masked chats here, connected chats from the page)
  const router = useRouter();
  useEffect(() => {
    if (demoMasked) return;
    const load = () =>
      supabase.rpc("my_masked_chats").then(({ data }) => {
        if (Array.isArray(data)) setMasked(data as RecentMasked[]);
      });
    void load();
    let t: ReturnType<typeof setTimeout> | null = null;
    const again = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void load();
        router.refresh();
      }, 600);
    };
    window.addEventListener(CHATS_EVENT, again);
    window.addEventListener("dp:badges", again);
    return () => {
      window.removeEventListener(CHATS_EVENT, again);
      window.removeEventListener("dp:badges", again);
      if (t) clearTimeout(t);
    };
  }, [supabase, demoMasked, router]);

  const items: Item[] = [
    ...matches.map((m) => ({
      key: `m-${m.id}`,
      href: `/matches/${m.id}`,
      at: m.last_message_at,
      name: m.display_name,
      photo: m.photos?.[0],
      label: m.display_name,
      unread: !!m.unread,
      waiting: !!m.last_message && !!m.last_sender && m.last_sender !== myId,
      note: m.note ?? null,
    })),
    ...masked.map((c) => {
      // You can see who it is if you paid to start it on Meet, or you both waved
      const known = paid[c.id];
      return {
        key: `s-${c.id}`,
        href: c.pact_slug && !c.pact_seen ? `/link/${c.pact_slug}` : `/masquerade/${c.id}`,
        at: c.last_at,
        photo: known?.photo ?? null,
        name: known?.name ?? undefined,
        mask: c.alias,
        label: known?.name || c.alias,
        unread: c.unread,
        waiting: c.last_mine === false,
      };
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  if (!items.length && !lead && !me) return null;
  const mine = fresh(myNote.at) ? myNote.note : null;
  // Room above the circles for note bubbles
  const notes = !!me || items.some((c) => c.note);
  return (
    <section data-tour="recent" className="mt-4 lg:mt-8" aria-label="Recent chats">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Recent chats</h2>
        <Link href="/matches" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
          All <ChevronRight size={15} />
        </Link>
      </div>
      <ul className={clsx("-mx-5 flex overflow-x-auto px-5 no-scrollbar lg:mx-0 lg:px-1", notes ? "gap-3 pt-[46px] pb-1" : "gap-2.5 py-1")}>
        {lead && <li className="shrink-0">{lead}</li>}
        {/* You: your note (tap to write one) */}
        {me && (
          <li className="relative flex w-[60px] shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                setNoteOpen(true);
              }}
              className="relative block h-12 w-12 active:scale-95"
              aria-label={mine ? `Your note: ${mine}. Change it` : "Write a note"}
            >
              <NoteBubble text={mine ?? "+ Note"} muted={!mine} />
              <Avatar src={me.photo ?? undefined} name="You" size={48} className="ring-2 ring-surface" />
            </button>
            <span className="w-full truncate text-center text-[11px] leading-[16.5px] font-medium text-muted">Your note</span>
          </li>
        )}
        {items.map((c) => (
          <li key={c.key} className={clsx("relative flex shrink-0 flex-col items-center gap-1", notes ? "w-[60px]" : "w-[52px]")}>
            {c.note && <NoteBubble text={c.note} />}
            <Link href={c.href} className="relative block h-12 w-12 active:scale-95" aria-label={`Chat with ${c.label}${c.unread ? ", new message" : c.waiting ? ", waiting for your reply" : ""}`}>
              {c.photo || !c.mask ? (
                <Avatar src={c.photo ?? undefined} name={c.name ?? c.label} size={48} className={"ring-2 ring-surface"} />
              ) : (
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full ${"ring-2 ring-surface"}`}
                  style={{ background: nameColor(c.mask) }}
                >
                  <MaskIcon className="w-7 text-white" eyes={nameColor(c.mask)} />
                </span>
              )}
              {c.unread ? (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-chili ring-2 ring-cream" aria-hidden />
              ) : c.waiting ? (
                // Read, but your reply is still owed
                <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-ink ring-2 ring-cream" aria-hidden />
              ) : null}
              {c.mask && c.photo && (
                // A masked chat with someone you know: a little mask on their photo
                <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-ink ring-2 ring-cream" aria-hidden>
                  <MaskIcon className="w-3.5 text-white" eyes="#1c1828" />
                </span>
              )}
            </Link>
            {/* Their name under the circle */}
            <span className="w-full truncate text-center text-[11px] leading-[16.5px] font-medium text-ink-soft">{(c.name ?? c.label).split(" ")[0]}</span>
          </li>
        ))}
      </ul>
      {me && (
        <NoteSheet
          open={noteOpen}
          onClose={() => setNoteOpen(false)}
          note={mine}
          noteAt={myNote.at}
          intent={me.intent}
          demo={me.demo}
          onSaved={(note, at) => setMyNote({ note, at })}
        />
      )}
    </section>
  );
}
