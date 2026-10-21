import type { Intent, Seeking, Gender } from "./types";

export const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "friends", label: "Friends", hint: "Good company, no pressure" },
  { value: "dating", label: "Dating", hint: "Looking for something real" },
  { value: "spicy", label: "Spicy link-up", hint: "Flirty and fun" },
];

export const SEEKING: { value: Seeking; label: string }[] = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "anyone", label: "Anyone" },
];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "nonbinary", label: "Non-binary" },
];

export const SPICE_LEVELS = [
  { value: 0, label: "Mild", short: "Mild" },
  { value: 1, label: "A little spicy", short: "Little spicy" },
  { value: 2, label: "Spicy", short: "Spicy" },
  { value: 3, label: "Extra spicy", short: "Extra spicy" },
];

export const INTEREST_OPTIONS = [
  "Music", "Travel", "Food", "Fitness", "Movies", "Books", "Gaming", "Art",
  "Fashion", "Tech", "Nature", "Dancing", "Photography", "Cooking", "Sports",
  "Faith", "Comedy", "Pets", "Business", "Nightlife", "Poetry", "Anime",
];

export const MASQUERADE_MINUTES = 5;

export function intentLabel(i: Intent) {
  return INTENTS.find((x) => x.value === i)?.label ?? i;
}
export function spiceLabel(s: number) {
  return SPICE_LEVELS[s]?.label ?? "Mild";
}
export function ageFromBirthdate(b: string | null) {
  if (!b) return null;
  const d = new Date(b);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
