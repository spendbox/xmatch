import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import { AppChrome } from "@/components/app/AppChrome";
import { ThingPromptsSync } from "@/components/app/ThingPromptsSync";
import { MaskUpdate } from "@/components/masks/MaskUpdate";
import { photosOf } from "@/components/masks/useMaskedPhotos";
import { PLACEHOLDER } from "@/lib/maskedPhotos";
import type { ThingPromptRow } from "@/lib/things";
import type { GiftRow, SettingRow } from "@/components/keys/usePrices";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  // Both at once: each one is a trip to the database
  const [profile, { data: prompts }, { data: settings }, { data: gifts }] = await Promise.all([
    getMyProfile(),
    // The "Things about you" cards (before update 82 runs this finds nothing and the built-in ones are used)
    supabase.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active"),
    // Prices and gifts as set in admin, so pages show the real price straight away
    supabase.from("app_settings").select("key, value"),
    supabase.from("gifts").select("id, name, emoji, price, sort, retired").order("sort"),
  ]);

  if (!profile?.display_name || !profile.birthdate || !profile.gender || !profile.photos?.length) {
    redirect("/onboarding");
  }

  return (
    <>
      <ThingPromptsSync rows={(prompts ?? null) as ThingPromptRow[] | null} />
      <AppChrome
        user={{ id: user.id, name: profile!.display_name ?? "You", photo: profile!.photos?.[0] }}
        settings={(settings ?? null) as SettingRow[] | null}
        gifts={(gifts ?? null) as GiftRow[] | null}
      >
        {children}
      </AppChrome>
      {/* Photos from before masks existed: offer to mask them */}
      {profile!.photos.includes(PLACEHOLDER) && <MaskUpdate userId={user.id} photos={photosOf(profile!)} />}
    </>
  );
}
