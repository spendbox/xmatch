import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import { AppChrome } from "@/components/app/AppChrome";
import { ThingPromptsSync } from "@/components/app/ThingPromptsSync";
import type { ThingPromptRow } from "@/lib/things";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  const profile = await getMyProfile();

  if (!profile?.display_name || !profile.birthdate || !profile.gender || !profile.photos?.length) {
    redirect("/onboarding");
  }

  // The "Things about you" cards (before update 82 runs this finds nothing and the built-in ones are used)
  const { data: prompts } = await supabase.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active");

  return (
    <>
      <ThingPromptsSync rows={(prompts ?? null) as ThingPromptRow[] | null} />
      <AppChrome user={{ id: user.id, name: profile!.display_name ?? "You", photo: profile!.photos?.[0] }}>{children}</AppChrome>
    </>
  );
}
