import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: contact }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("accounts_private").select("email, phone").eq("user_id", user!.id).maybeSingle(),
    supabase.from("matches").select("id", { count: "exact", head: true }),
  ]);
  return (
    <ProfileEditor
      profile={profile as Profile}
      email={contact?.email ?? user!.email ?? ""}
      phone={contact?.phone ?? ""}
      matchCount={count ?? 0}
    />
  );
}
