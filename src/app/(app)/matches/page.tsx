import { createClient } from "@/lib/supabase/server";
import type { MatchSummary } from "@/lib/types";
import { MatchesList } from "@/components/matches/MatchesList";

export const metadata = { title: "Matches" };

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.rpc("get_matches");
  return <MatchesList matches={(data ?? []) as MatchSummary[]} myId={user!.id} />;
}
