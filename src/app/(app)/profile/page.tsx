import { getAuth, getMyProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user } = await getAuth();
  const [{ data: profile }, { data: contact }, { count }] = await Promise.all([
    getMyProfile().then((data) => ({ data })),
    supabase.from("accounts_private").select("email").eq("user_id", user!.id).maybeSingle(),
    supabase.from("matches").select("id", { count: "exact", head: true }),
  ]);
  return (
    <ProfileEditor
      profile={profile as Profile}
      email={contact?.email ?? user!.email ?? ""}
      matchCount={count ?? 0}
    />
  );
}
