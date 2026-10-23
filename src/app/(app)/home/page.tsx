import { redirect } from "next/navigation";
import { getAuth, getMatches, getMyProfile } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import type { Profile } from "@/lib/types";
import type { Wallet } from "@/lib/keys";
import type { DashpadEvent } from "@/lib/events";
import type { MasqueradeHour } from "@/lib/hourly";
import type { MeetList } from "@/lib/meets";
import { HomeScreen } from "@/components/home/HomeScreen";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  // Everything loads at the same time
  const [profile, { data: wallet }, { data: nextEvent }, { data: hour }, { data: meets }, matches] = await Promise.all([
    getMyProfile(),
    supabase.rpc("my_wallet"),
    supabase.rpc("next_event"),
    supabase.rpc("my_masquerade_hour"),
    FEATURES.meets ? supabase.rpc("list_meets", { p_limit: 4 }) : Promise.resolve({ data: null }),
    getMatches(),
  ]);

  return (
    <HomeScreen
      profile={profile as Profile}
      wallet={(wallet as Wallet) ?? null}
      nextEvent={(nextEvent as DashpadEvent | null) ?? null}
      hour={(hour as MasqueradeHour | null) ?? null}
      meets={(meets as MeetList | null) ?? null}
      matches={matches}
    />
  );
}
