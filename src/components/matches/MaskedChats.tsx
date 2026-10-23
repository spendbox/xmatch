"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { nameColor } from "@/lib/eventSpace";

type MaskedChat = {
  id: string;
  alias: string;
  my_alias: string;
  from_meet: boolean;
  my_vote: boolean | null;
  they_unmasked: boolean;
  last_message: string | null;
  last_mine: boolean | null;
  last_at: string;
  unread: boolean;
};

/** Chats: masked chats with no time limit (started from Meet, or reopened). You're both masked until you both unmask. */
export function MaskedChats({ term = "", demo }: { term?: string; demo?: MaskedChat[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [chats, setChats] = useState<MaskedChat[]>(demo ?? []);

  useEffect(() => {
    if (demo) return;
    supabase.rpc("my_masked_chats").then(({ data }) => Array.isArray(data) && setChats(data as MaskedChat[]));
  }, [supabase, demo]);

  const shown = term ? chats.filter((c) => c.alias.toLowerCase().includes(term) || (c.last_message ?? "").toLowerCase().includes(term)) : chats;
  if (!shown.length) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">Masked chats</h2>
      <ul className="space-y-2.5">
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={`/masquerade/${c.id}`}
              className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-3 pr-4 shadow-card transition hover:border-line-strong active:scale-[0.98]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: nameColor(c.alias) }}>
                <MaskIcon className="w-8 text-white" eyes={nameColor(c.alias)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[16px] font-semibold">{c.alias}</span>
                  <span className={clsx("shrink-0 text-[12px]", c.unread ? "font-semibold text-brand" : "text-muted")}>{ago(c.last_at)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={clsx("min-w-0 flex-1 truncate text-[14px]", c.unread ? "font-medium text-ink" : "text-muted")}>
                    {c.they_unmasked && c.my_vote !== true
                      ? `${c.alias} unmasked · your move`
                      : c.last_message
                        ? `${c.last_mine ? "You: " : ""}${c.last_message}`
                        : c.from_meet
                          ? "Started from Meet · say hi"
                          : "Reopened · say hi"}
                  </span>
                  {c.unread ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="New messages" />
                  ) : (
                    <span className="shrink-0 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-soft">Masked</span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
