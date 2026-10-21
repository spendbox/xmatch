import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { MasqueradeSetup } from "@/components/masquerade/MasqueradeSetup";

export const metadata = { title: "Masquerade" };

export default async function MasqueradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: active } = await supabase
    .from("masquerade_sessions")
    .select("id")
    .eq("status", "active")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .gt("ends_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (active) redirect(`/masquerade/${active.id}`);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return <MasqueradeSetup profile={profile as Profile} />;
}
