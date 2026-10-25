"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHATS_EVENT } from "@/components/app/useMenuBadges";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { nameColor } from "@/lib/eventSpace";
import type { MatchSummary } from "@/lib/types";
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

type Item = { key: string; href: string; at: string; label: string; waiting: boolean; photo?: string | null; name?: string; mask?: string };

/**
 * Home: your latest chats (connected and masked) as small circles, no names.
 * A dot shows when their last message is still waiting for your reply.
 */
export function RecentChats({ matches, myId, demoMasked }: { matches: MatchSummary[]; myId: string; demoMasked?: RecentMasked[] }) {
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
      waiting: !!m.unread || (!!m.last_message && !!m.last_sender && m.last_sender !== myId),
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
        waiting: c.unread || c.last_mine === false,
      };
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  if (!items.length) return null;
  return (
    <section className="mt-4 lg:mt-8" aria-label="Recent chats">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Recent chats</h2>
        <Link href="/matches" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
          All <ChevronRight size={15} />
        </Link>
      </div>
      <ul className="-mx-5 flex gap-2.5 overflow-x-auto px-5 py-1 no-scrollbar lg:mx-0 lg:px-1">
        {items.map((c) => (
          <li key={c.key} className="shrink-0">
            <Link href={c.href} className="relative block active:scale-95" aria-label={`Chat with ${c.label}${c.waiting ? ", waiting for your reply" : ""}`}>
              {c.photo || !c.mask ? (
                <Avatar src={c.photo ?? undefined} name={c.name ?? c.label} size={48} className={c.waiting ? "ring-2 ring-brand ring-offset-2 ring-offset-cream" : "ring-2 ring-surface"} />
              ) : (
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full ${c.waiting ? "ring-2 ring-brand ring-offset-2 ring-offset-cream" : "ring-2 ring-surface"}`}
                  style={{ background: nameColor(c.mask) }}
                >
                  <MaskIcon className="w-7 text-white" eyes={nameColor(c.mask)} />
                </span>
              )}
              {c.waiting && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-chili ring-2 ring-cream" aria-hidden />}
              {c.mask && c.photo && (
                // A masked chat with someone you know: a little mask on their photo
                <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-ink ring-2 ring-cream" aria-hidden>
                  <MaskIcon className="w-3.5 text-white" eyes="#1c1828" />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
