import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import type { MatchSummary } from "@/lib/types";

export function MatchesList({ matches, myId }: { matches: MatchSummary[]; myId: string }) {
  return (
    <main className="mx-auto max-w-md px-5 pt-6">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Matches</h1>
      <p className="mt-1.5 text-[15px] text-muted">People you unmasked with.</p>

      {matches.length === 0 ? (
        <div className="mt-12 flex flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center shadow-card">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
            <Heart size={28} />
          </span>
          <h2 className="mt-5 text-xl font-semibold">No matches yet</h2>
          <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
            Put on your mask, have a great five minutes, and unmask together.
          </p>
          <ButtonLink href="/masquerade" variant="gold" className="mt-6 h-12 px-6">
            Start a Masquerade
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="mt-5 -mx-5 flex gap-4 overflow-x-auto px-5 py-1.5 no-scrollbar">
            {matches.map((m) => (
              <Link key={m.id} href={`/matches/${m.id}`} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                <Avatar src={m.photos?.[0]} name={m.display_name} size={64} className="ring-2 ring-brand ring-offset-2 ring-offset-cream" />
                <span className="w-full truncate text-center text-[13px] font-medium">{m.display_name}</span>
              </Link>
            ))}
          </div>

          <h2 className="mt-6 mb-2 text-[15px] font-semibold">Messages</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3.5 px-4 py-3.5 active:bg-cream">
                  <Avatar src={m.photos?.[0]} name={m.display_name} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">
                        {m.display_name}, {m.age}
                      </p>
                      <span className="shrink-0 text-[12px] text-muted">{timeAgo(m.last_message_at)}</span>
                    </div>
                    <p className="truncate text-[14px] text-muted">
                      {m.last_message
                        ? `${m.last_sender === myId ? "You: " : ""}${m.last_message.replace(/^💬 /, "")}`
                        : "Say hi 👋"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
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
