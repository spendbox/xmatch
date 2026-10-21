import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { MatchSummary, Profile } from "@/lib/types";
import type { Wallet } from "@/lib/keys";
import { HomeScreen, type HomeStats } from "@/components/home/HomeScreen";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  // Everything loads at the same time
  const [{ data: active }, profile, { data: wallet }, { data: stats }, { data: matches }] = await Promise.all([
    supabase
      .from("masquerade_sessions")
      .select("id")
      .eq("status", "active")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .gt("ends_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1)
      .maybeSingle(),
    getMyProfile(),
    supabase.rpc("my_wallet"),
    supabase.rpc("home_stats"),
    supabase.rpc("get_matches"),
  ]);
  if (active) redirect(`/masquerade/${active.id}`);

  return (
    <HomeScreen
      profile={profile as Profile}
      wallet={(wallet as Wallet) ?? null}
      stats={(stats as HomeStats) ?? null}
      matches={((matches ?? []) as MatchSummary[]).slice(0, 8)}
    />
  );
}
