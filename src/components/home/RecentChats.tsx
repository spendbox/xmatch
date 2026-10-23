import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MatchSummary } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

/** Your last 10 chats as circles. Tap one to open it. */
export function RecentChats({ matches }: { matches: MatchSummary[] }) {
  if (!matches.length) return null;
  const recent = [...matches].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)).slice(0, 10);
  return (
    <section className="mt-5 lg:mt-8" aria-label="Recent chats">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Recent chats</h2>
        <Link href="/matches" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
          More <ChevronRight size={16} />
        </Link>
      </div>
      <ul className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 no-scrollbar lg:mx-0 lg:px-0">
        {recent.map((m) => (
          <li key={m.id} className="shrink-0">
            <Link href={`/matches/${m.id}`} className="flex w-[68px] flex-col items-center gap-1.5 text-center active:scale-95" aria-label={`Chat with ${m.display_name}${m.unread ? ", new messages" : ""}`}>
              <span className="relative">
                <Avatar
                  src={m.photos?.[0]}
                  name={m.display_name}
                  size={64}
                  className={m.unread ? "ring-[3px] ring-brand ring-offset-2 ring-offset-cream" : "ring-2 ring-surface"}
                />
                {m.unread && <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-chili ring-2 ring-cream" />}
              </span>
              <span className="w-full truncate text-[12px] font-semibold text-ink-soft">{m.display_name.split(" ")[0]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
