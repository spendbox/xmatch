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
  /** How well you match, 0 to 100 (update 106) */
  match?: number;
  /** An interest to show: one you share first */
  tag?: string | null;
  /** How far away, in km (when you've both shared where you are) */
  km?: number | null;
  /** Interests you share, up to 3 (update 107) */
  shared?: string[];
  /** You waved at them / they waved at you */
  i_waved?: boolean;
  waved_me?: boolean;
  /** Photos you can see (all once unlocked or connected), and how many they have (update 108) */
  photos?: string[];
  photo_count?: number;
  photos_unlocked?: boolean;
  /** Their note for today */
  note?: string | null;
  /** Signs of life: minutes since they were last on, reply speed and rate, new this week, views this week */
  seen_minutes?: number | null;
  reply_seconds?: number | null;
  reply_rate?: number | null;
  is_new?: boolean;
  views_7d?: number;
};

export type ExploreList = {
  message_cost: number;
  photos_cost: number;
  /** People can pay to see someone's other photos (Admin switch) */
  photos_paid?: boolean;
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
  /** Whether you can pay Keys to see their other photos (otherwise: once you're connected) */
  photos_paid?: boolean;
  /** You've waved at them / they've waved at you */
  i_waved?: boolean;
  waved_me?: boolean;
  /** Keys to wave first (0: free); waving back is always free */
  wave_cost?: number;
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

/** Someone who viewed your profile */
export type Viewer = {
  id: string;
  name: string;
  photo: string | null;
  online: boolean;
  seen_at: string;
  waved_me: boolean;
  i_waved: boolean;
  connected: boolean;
  /** A masked chat you already have with them (you both waved, or one of you messaged) */
  chat_id?: string | null;
};

export type Viewers = { today: number; people: Viewer[]; /** Keys to wave first (0: free) */ wave_cost?: number };
