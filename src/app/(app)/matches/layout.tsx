import { getAuth, getMatches } from "@/lib/auth";
import { MatchesList } from "@/components/matches/MatchesList";

/** On computers: your conversations on the left, the open chat on the right. */
export default async function MatchesLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuth();
  const matches = await getMatches();
  return (
    <div className="lg:flex lg:h-dvh">
      <aside className="hidden lg:block lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-cream">
        <MatchesList matches={matches} myId={user!.id} variant="sidebar" />
      </aside>
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
