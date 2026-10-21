import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { MasqueradeSetup } from "@/components/masquerade/MasqueradeSetup";

export const metadata = { title: "Masquerade" };

export default async function MasqueradePage() {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  // Both lookups run at the same time
  const [{ data: active }, profile] = await Promise.all([
    supabase
      .from("masquerade_sessions")
      .select("id")
      .eq("status", "active")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .gt("ends_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1)
      .maybeSingle(),
    getMyProfile(),
  ]);
  if (active) redirect(`/masquerade/${active.id}`);
  return <MasqueradeSetup profile={profile as Profile} />;
}
