"use client";

import Link from "next/link";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import { gameInfo } from "@/lib/games";
import { meetLeft, type MeetChat, type MeetList } from "@/lib/meets";
import type { DashpadEvent } from "@/lib/events";
import { useNow } from "@/components/events/EventCard";
import { EventsScreen } from "@/components/events/EventsScreen";
import { MaskAvatar } from "@/components/feed/MaskAvatar";
import { MeetCard } from "./MeetCard";
import { YourMeet } from "./YourMeet";
import { useMeets } from "./useMeets";

/** The Meet page: people's meets (and your meet chats) on one tab, events on the other */
export function MeetScreen({
  initial,
  initialChats = null,
  events,
  tab,
}: {
  initial: MeetList | null;
  /** Design previews */
  initialChats?: MeetChat[] | null;
  events: DashpadEvent[];
  tab: "meets" | "events";
}) {
  const router = useRouter();
  const now = useNow(30_000);
  const { list, myChats, refresh } = useMeets(initial, { chats: true, initialChats });
  const posts = list?.posts ?? [];

  return (
    <main className="mx-auto max-w-md px-5 pt-6 lg:max-w-6xl lg:px-10 lg:pt-10">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight lg:text-[40px]">Meet</h1>
      <p className="mt-1 text-[15px] text-muted">People posting right now, and themed nights coming up.</p>

      <div role="tablist" aria-label="Show" className="mt-5 grid grid-cols-2 gap-1.5 rounded-full border border-line bg-surface p-1 lg:max-w-sm">
        {(["meets", "events"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => router.replace(t === "meets" ? "/meet" : "/meet?tab=events", { scroll: false })}
            className={clsx("h-10 rounded-full text-[14px] font-semibold transition", tab === t ? "bg-brand text-white" : "text-ink-soft hover:bg-cream")}
          >
            {t === "meets" ? `Meets${posts.length ? ` · ${posts.length}` : ""}` : `Events${events.length ? ` · ${events.length}` : ""}`}
          </button>
        ))}
      </div>

      {tab === "events" ? (
        <EventsScreen events={events} embedded />
      ) : (
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
          <div className="lg:col-span-7">
            {list?.mine && (
              <section className="mt-7">
                <h2 className="mb-3 text-[15px] font-semibold">Your meet</h2>
                <YourMeet meet={list.mine} now={now} onClosed={refresh} />
              </section>
            )}

            <section className="mt-7">
              <h2 className="mb-3 text-[15px] font-semibold">For you now</h2>
              {posts.length ? (
                <div className="grid gap-3">
                  {posts.map((m) => (
                    <MeetCard key={m.id} meet={m} now={now} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-[32px] border border-line bg-surface px-6 py-10 text-center shadow-card">
                  <span className="grid h-16 w-16 animate-float place-items-center rounded-2xl bg-brand-soft text-brand">
                    <UsersRound size={30} />
                  </span>
                  <h3 className="mt-5 text-[20px] font-semibold">No meets for you right now</h3>
                  <p className="mt-1.5 max-w-sm text-[15px] text-muted">
                    Post one from Home with the <span className="font-semibold text-ink">+</span> button, or check back soon.
                  </p>
                </div>
              )}
              <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">You only see people whose settings fit yours, and yours fit theirs.</p>
            </section>
          </div>

          {!!myChats?.length && (
            <section className="mt-7 lg:col-span-5">
              <h2 className="mb-3 text-[15px] font-semibold">Your meet chats</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
                {myChats.map((c) => (
                  <li key={c.id}>
                    <Link href={`/masquerade/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                      <MaskAvatar alias={c.their_alias} size={42} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{c.their_alias}</span>
                        <span className="block truncate text-[13px] text-muted">
                          {c.last_message ?? (c.mine ? "Met you from your meet" : `From their ${c.kind === "game" && c.game ? gameInfo(c.game).title : "post"}`)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {c.game_status ? (
                          <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[12px] font-semibold text-[#8a5a00]">
                            {c.game_status === "active" ? "Playing" : "Ready to play"}
                          </span>
                        ) : c.in_line && c.status === "active" ? (
                          <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-ink-soft">In line</span>
                        ) : c.status === "lapsed" ? (
                          <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-muted">Time&apos;s up</span>
                        ) : (
                          <span className="text-[12px] text-muted">{now ? meetLeft(c.ends_at, now) : ""}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <div className="h-6" />
    </main>
  );
}
