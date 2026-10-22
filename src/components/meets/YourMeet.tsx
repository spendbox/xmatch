"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { gameInfo } from "@/lib/games";
import { meetLeft, type Meet } from "@/lib/meets";
import { MeetTile } from "./MeetCard";

/** Your own live meet: how long it has left and how many people met you */
export function YourMeet({ meet, now, href, onClosed }: { meet: Meet; now: number | null; href?: string; onClosed?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const title = meet.kind === "game" && meet.game ? gameInfo(meet.game).title : "Your text post";
  const stats = [
    now ? meetLeft(meet.ends_at, now) : null,
    `${meet.people} ${meet.people === 1 ? "person" : "people"} met you`,
    meet.waiting ? `${meet.waiting} waiting to play` : null,
  ].filter(Boolean);

  async function takeDown() {
    if (!confirm("Take your meet down? Nobody new can meet you from it. Chats you already have stay open.")) return;
    setBusy(true);
    await supabase.rpc("close_meet", { p_meet: meet.id });
    setBusy(false);
    onClosed?.();
  }

  const inner = (
    <>
      <MeetTile meet={meet} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title} · live</span>
        {meet.body && <span className="block truncate text-[13px] text-muted">“{meet.body}”</span>}
        <span className="mt-0.5 block truncate text-[13px] text-muted">{stats.join(" · ")}</span>
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-surface p-3">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          {inner}
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      {!href && onClosed && (
        <button
          type="button"
          onClick={takeDown}
          disabled={busy}
          className="h-9 shrink-0 rounded-full border border-line-strong px-3 text-[13px] font-semibold text-ink-soft hover:bg-cream disabled:opacity-50"
        >
          Take down
        </button>
      )}
    </div>
  );
}
