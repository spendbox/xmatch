import { redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import { Onboarding } from "./Onboarding";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const { user } = await getAuth();
  if (!user) redirect("/login");
  const profile = await getMyProfile();
  return <Onboarding profile={profile as Profile} />;
}
