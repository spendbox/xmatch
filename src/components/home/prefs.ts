import type { Intent, Profile, Seeking } from "@/lib/types";

export type SetupPrefs = {
  intent: Intent;
  seeking: Seeking;
  ageMin: number;
  ageMax: number;
  spice: number;
  maxKm: number; // 0 = anywhere
};

export function prefsFromProfile(p: Profile): SetupPrefs {
  return {
    intent: p.pref_intent,
    seeking: p.pref_seeking,
    ageMin: p.pref_age_min,
    ageMax: p.pref_age_max,
    spice: p.pref_spice,
    maxKm: p.pref_max_km ?? 50,
  };
}

export const INTENT_HINTS: Record<Intent, string> = {
  friends: "Good company, zero pressure",
  dating: "Looking for something real",
  spicy: "Flirty, fun and bold",
};
export const SPICE_HINTS = ["Easy, getting-to-know-you questions", "Playful with a little flirt", "Flirty and personal", "Bold, cheeky questions"];
export const DISTANCE_HINTS: Record<number, string> = {
  10: "Your neighbourhood",
  50: "Across your city",
  200: "Nearby cities too",
  0: "Anyone, anywhere",
};
