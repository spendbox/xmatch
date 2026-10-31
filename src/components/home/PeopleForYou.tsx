"use client";

import { MaskIcon } from "@/components/ui/MaskIcon";
import { useState } from "react";
import { Photo } from "@/components/ui/Photo";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, MessageCircle, Snowflake, UserRound, UsersRound } from "lucide-react";
import { IcebreakerSheet } from "./IcebreakerSheet";
import type { ExploreList } from "@/lib/explore";
import { tapFeedback } from "@/components/ui/Button";
import { useMeetList } from "@/components/explore/useMeetList";
import { isOnline, usePresence } from "@/lib/usePresence";
import { ExploreProfileSheet } from "@/components/explore/ExploreProfileSheet";

const SHOWN = 6;

/** Home: your 20 closest matches from Meet, in small circles (4 across), and a way to the rest */
export function PeopleForYou({ userId, demo, demoBreak, demoBreakMode }: { userId: string; demo?: ExploreList; /** Previews: open the icebreaker for this person */ demoBreak?: number; demoBreakMode?: "card" | "this" | "voice" | "game" }) {
  const { list, reload } = useMeetList(userId, demo ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const [breaking, setBreaking] = useState<string | null>(demoBreak != null ? (demo?.people[demoBreak]?.id ?? null) : null);
  // In the order Dashpad suggests: people who fit your gender, mood and age first (being online
  // already counts in that order). Who's online is checked live (every 30s), the same way as in
  // Chats, for the green dot; the list itself is kept for 10 minutes
  const { seen, now } = usePresence(demo ? [] : (list?.people ?? []).slice(0, 50).map((p) => p.id));
  const live = (p: { id: string; online: boolean }) => (demo || !(p.id in seen) ? p.online : isOnline(seen[p.id], now));
  const people = [...(list?.people ?? [])]
    .map((p) => ({ ...p, online: live(p) }))
    .slice(0, SHOWN);
  if (list && people.length === 0) return null;

  return (
    <section data-tour="people" className="mt-6 lg:mt-0 lg:mb-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">People for you</h2>
        {/* Meet (everyone, search and filters) lives here now */}
        <Link href="/meet" onClick={tapFeedback} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface pr-2.5 pl-3 text-[13px] font-semibold text-ink transition active:scale-95">
          <UsersRound size={15} className="text-brand" /> Meet everyone <ChevronRight size={15} className="text-muted" />
        </Link>
      </div>

      {/* One post per person, like Instagram: every card the same size */}
      <ul className="space-y-4">
        {list
          ? people.map((p, i) => (
              <li key={p.id} className="animate-fade-up overflow-hidden rounded-[24px] border border-line bg-surface" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                {/* Who */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="relative h-9 w-9 shrink-0">
                    <span className="block h-full w-full overflow-hidden rounded-full p-[2px]" style={{ background: "linear-gradient(135deg,#f2b33d,#e0477e,#8f3fd9)" }}>
                      <span className="block h-full w-full overflow-hidden rounded-full bg-surface p-[1.5px]">
                        {p.photo ? <Photo src={p.photo} id={p.id} gender={p.gender} className="h-full w-full rounded-full object-cover" /> : <span className="block h-full w-full rounded-full bg-brand-soft" />}
                      </span>
                    </span>
                    {p.online && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-surface" />}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[14px] font-semibold">
                      {p.name.split(" ")[0]}
                      {p.age != null && <span className="font-normal text-muted">, {p.age}</span>}
                    </p>
                    <p className="truncate text-[12px] text-muted">{[p.place, p.km != null ? `${p.km} km away` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  {p.match != null && <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-bold text-brand-ink">{p.match}% match</span>}
                </div>
                {/* Their photo (masked until you both unmask) */}
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setOpen(p.id);
                  }}
                  className="group relative block aspect-[4/4.4] w-full overflow-hidden bg-brand-soft"
                  aria-label={`${p.name}'s profile`}
                >
                  {p.photo ? (
                    <Photo src={p.photo} id={p.id} gender={p.gender} loading="lazy" small={false} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[40px] font-semibold text-brand">{p.name.charAt(0)}</span>
                  )}
                  {!p.connected && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      <MaskIcon className="w-3.5 text-white" eyes="rgba(0,0,0,0.4)" /> Masked
                    </span>
                  )}
                </button>
                {/* What to do */}
                <div className="flex items-center gap-2 px-3 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      if (p.connected) setOpen(p.id);
                      else setBreaking(p.id);
                    }}
                    className={clsx(
                      "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition active:scale-95",
                      p.connected ? "border border-line bg-surface text-ink" : "bg-brand text-white",
                    )}
                  >
                    {/* Never met: break the ice. Already chatting: Message */}
                    {p.connected ? (
                      <>
                        <MessageCircle size={16} /> Message
                      </>
                    ) : (
                      <>
                        <Snowflake size={16} /> Break the ice
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setOpen(p.id);
                    }}
                    aria-label={`See ${p.name}'s profile`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-ink-soft active:scale-95"
                  >
                    <UserRound size={18} />
                  </button>
                </div>
                {/* Caption */}
                <p className="truncate px-3.5 pt-2 pb-3 text-[13px] text-ink-soft">
                  <b className="font-semibold text-ink">{p.name.split(" ")[0]}</b> is into {p.tag ?? "meeting new people"}
                  {p.online ? " · online now" : ""}
                </p>
              </li>
            ))
          : Array.from({ length: 2 }, (_, i) => <li key={i} className="aspect-[4/5.6] animate-pulse rounded-[24px] bg-ink/[0.06]" />)}
      </ul>
      {list && (
        <Link href="/meet" onClick={tapFeedback} className="mt-4 flex h-12 items-center justify-center gap-1.5 rounded-full border border-line bg-surface text-[14px] font-semibold text-brand transition active:scale-[0.98]">
          <UsersRound size={16} /> See more people on Meet
        </Link>
      )}

      {open && <ExploreProfileSheet personId={open} onClose={() => setOpen(null)} onChanged={reload} />}
      <IcebreakerSheet person={people.find((x) => x.id === breaking) ?? null} open={!!breaking} onClose={() => setBreaking(null)} demoMode={demoBreakMode} demo={!!demo} onSent={reload} />
    </section>
  );
}
