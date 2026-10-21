import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/app/AppChrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birthdate, gender, photos")
    .eq("id", user.id)
    .single();

  if (!profile?.display_name || !profile.birthdate || !profile.gender || !profile.photos?.length) {
    redirect("/onboarding");
  }

  return <AppChrome userId={user.id}>{children}</AppChrome>;
}
