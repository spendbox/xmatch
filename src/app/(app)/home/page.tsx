import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { MatchSummary, Profile } from "@/lib/types";
import type { Wallet } from "@/lib/keys";
import type { DashpadEvent } from "@/lib/events";
import type { MasqueradeHour } from "@/lib/hourly";
import { HomeScreen, type HomeStats } from "@/components/home/HomeScreen";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  // Everything loads at the same time
  const [profile, { data: wallet }, { data: stats }, { data: matches }, { data: nextEvent }, { data: hour }] = await Promise.all([
    getMyProfile(),
    supabase.rpc("my_wallet"),
    supabase.rpc("home_stats"),
    supabase.rpc("get_matches"),
    supabase.rpc("next_event"),
    supabase.rpc("my_masquerade_hour"),
  ]);

  return (
    <HomeScreen
      profile={profile as Profile}
      wallet={(wallet as Wallet) ?? null}
      stats={(stats as HomeStats) ?? null}
      matches={((matches ?? []) as MatchSummary[]).slice(0, 8)}
      nextEvent={(nextEvent as DashpadEvent | null) ?? null}
      hour={(hour as MasqueradeHour | null) ?? null}
    />
  );
}
