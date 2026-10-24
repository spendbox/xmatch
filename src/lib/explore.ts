import type { Gender, Intent } from "@/lib/types";

/** Someone in the Explore grid */
export type ExplorePerson = {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  /** Their main photo (the only one you see until you unlock or connect) */
  photo: string | null;
  place: string | null;
  /** Only once you've both chatted */
  intent: Intent | null;
  online: boolean;
  /** You already have a chat with them */
  connected: boolean;
};

export type ExploreList = {
  message_cost: number;
  photos_cost: number;
  people: ExplorePerson[];
};

/** One person's profile as you may see it */
export type ExploreProfile = {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  bio: string;
  interests: string[];
  place: string | null;
  /** What they're in the mood for: only once you've both chatted */
  intent: Intent | null;
  online: boolean;
  photos: string[];
  photo_count: number;
  photos_unlocked: boolean;
  match_id: string | null;
  shared_interests: string[];
  message_cost: number;
  photos_cost: number;
  /** A masked chat you already have with them from Meet */
  masked_id?: string | null;
  /** Their "things about me" (only once you're connected) */
  things?: { p: string; a: string }[];
  /** How many things about them there are (shown before you're connected) */
  things_count?: number;
  /** Words you both used in your things */
  shared_words?: string[];
};
