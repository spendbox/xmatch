"use client";

import { useMemo, useState } from "react";
import { Photo } from "@/components/ui/Photo";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, MessageCircle, Search, Users } from "lucide-react";
import { intentLabel } from "@/lib/constants";
import { isOnline, usePresence } from "@/lib/usePresence";
import type { Intent, MatchSummary } from "@/lib/types";
import { INTENT_ICONS } from "@/components/ui/icons";

/** Everyone you're connected with, in one place. */
export function YourPeople({ matches }: { matches: MatchSummary[]; myId: string }) {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState<Intent | "all">("all");
  const { seen, now } = usePresence(matches.map((m) => m.other_id));
  const list = useMemo(
    () =>
      [...matches]
        .filter((m) => (mood === "all" || m.intent === mood) && (!q || m.display_name.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [matches, q, mood],
  );
  const online = matches.filter((m) => isOnline(seen[m.other_id], now)).length;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-8 lg:max-w-3xl lg:px-10 lg:pt-10">
      <Link href="/matches" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink lg:hidden">
        <ArrowLeft size={16} /> Chats
      </Link>
      <header className="mt-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Your people</h1>
          <p className="mt-1 text-[15px] text-muted">
            {matches.length === 1 ? "1 connection" : `${matches.length} connections`}
            {online > 0 ? ` · ${online} online now` : ""}
          </p>
        </div>
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Users size={20} />
        </span>
      </header>

      {matches.length > 0 && (
        <>
          <label className="mt-5 flex h-11 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-brand">
            <Search size={17} className="shrink-0 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your people" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {(["all", "friends", "dating", "spicy"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMood(k)}
                className={clsx(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                  mood === k ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft",
                )}
              >
                {k !== "all" && INTENT_ICONS[k]({ size: 14 })}
                {k === "all" ? "Everyone" : intentLabel(k)}
              </button>
            ))}
          </div>
        </>
      )}

      {matches.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line-strong p-8 text-center">
          <p className="text-[16px] font-semibold">No connections yet</p>
          <p className="mt-1 text-[14px] text-muted">When you and your masked pair both unmask, they show up here.</p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((m) => {
            const on = isOnline(seen[m.other_id], now);
            return (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="block overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition active:scale-[0.98]">
                  <span className="relative block aspect-[4/5] bg-line">
                    {m.photos?.[0] && (
                      <Photo src={m.photos[0]} id={m.other_id} alt={m.display_name} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span
                      className={clsx("absolute top-2.5 right-2.5 h-3 w-3 rounded-full ring-2 ring-white", on ? "bg-mint" : "bg-[#b9b3c4]")}
                      aria-label={on ? "Online" : "Offline"}
                    />
                  </span>
                  <span className="flex items-center gap-2 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {m.display_name}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[12px] text-muted">
                        {INTENT_ICONS[m.intent]({ size: 12 })} {intentLabel(m.intent)}
                      </span>
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white">
                      <MessageCircle size={16} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
