import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import { AppChrome } from "@/components/app/AppChrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuth();
  if (!user) redirect("/login");
  const profile = await getMyProfile();

  if (!profile?.display_name || !profile.birthdate || !profile.gender || !profile.photos?.length) {
    redirect("/onboarding");
  }

  return <AppChrome userId={user.id}>{children}</AppChrome>;
}
