import { getAuth } from "@/lib/auth";
import type { ExploreList } from "@/lib/explore";
import { ExploreScreen } from "@/components/explore/ExploreScreen";

export const metadata = { title: "Meet" };

export default async function MeetPage() {
  const { supabase } = await getAuth();
  const { data } = await supabase.rpc("explore_people", { p_limit: 60 });
  return <ExploreScreen initial={(data as ExploreList | null) ?? null} />;
}
