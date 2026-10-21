import { getAuth, getMyProfile } from "@/lib/auth";
import type { MatchSummary } from "@/lib/types";
import { MatchesList } from "@/components/matches/MatchesList";

export const metadata = { title: "Matches" };

export default async function MatchesPage() {
  const { supabase, user } = await getAuth();
  const { data } = await supabase.rpc("get_matches");
  return <MatchesList matches={(data ?? []) as MatchSummary[]} myId={user!.id} />;
}
