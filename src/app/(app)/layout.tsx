import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import { getAppConfig } from "@/lib/appConfig";
import { AppChrome } from "@/components/app/AppChrome";
import { ThingPromptsSync } from "@/components/app/ThingPromptsSync";
import { MaskUpdate } from "@/components/masks/MaskUpdate";
import { MaskedNotice } from "@/components/masks/MaskedNotice";
import { PLACEHOLDER, photosOf } from "@/lib/photoSet";
import type { ThingPromptRow } from "@/lib/things";
import type { GiftRow, SettingRow } from "@/components/keys/usePrices";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuth();
  if (!user) redirect("/login");
  // Both at once. Your profile is fetched; prices, gifts and the "Things about you" cards are the
  // same for everyone and kept for a minute (lib/appConfig), so they usually cost no trip at all
  const [profile, config] = await Promise.all([getMyProfile(), getAppConfig().catch(() => ({ prompts: null, settings: null, gifts: null }))]);
  const { prompts, settings, gifts } = config;

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
      {profile!.photos.includes(PLACEHOLDER) ? (
        <MaskUpdate userId={user.id} photos={photosOf(profile!)} />
      ) : (
        // Masked for them by Dashpad: show them, once
        profile!.photo_masks?.some((m) => m && !("none" in m) && m.auto) && <MaskedNotice userId={user.id} photos={photosOf(profile!)} />
      )}
    </>
  );
}
