import type { ChatBgId } from "./chatBackgrounds";
import type { Intent } from "./types";

/**
 * Each mood (friends, dating, spicy) gives Dashpad its own colours, words and defaults,
 * so switching mood changes how the app feels, not just who you meet.
 */
export type Mood = {
  /** The Masquerade card and other mood-coloured surfaces */
  gradient: string;
  /** Buttons and highlights on light backgrounds */
  accent: string;
  /** What we call the person you're paired with */
  pairWord: string;
  /** "Looking for your next buddy" (the card while you wait) */
  looking: string;
  /** The unmask button */
  unmask: string;
  /** Gifts shown first in the gift picker (the rest follow in their usual order) */
  gifts: string[];
  /** The chat background when you haven't picked one */
  chatBg: ChatBgId;
};

export const MOODS: Record<Intent, Mood> = {
  friends: {
    gradient: "linear-gradient(135deg, #0f7a55 0%, #1f9d6b 55%, #5fbf7f 100%)",
    accent: "#1f9d6b",
    pairWord: "buddy",
    looking: "Looking for your next buddy",
    unmask: "Be friends",
    gifts: ["thumbsup", "jollof", "gg", "clap", "coffee", "fire"],
    chatBg: "mint",
  },
  dating: {
    gradient: "linear-gradient(135deg, #5b3fd9 0%, #8f3fd9 55%, #d0458a 100%)",
    accent: "#8f3fd9",
    pairWord: "date",
    looking: "Looking for your date",
    unmask: "Unmask",
    gifts: ["rose", "coffee", "cocktail", "thumbsup", "crown", "diamond"],
    chatBg: "lilac",
  },
  spicy: {
    gradient: "linear-gradient(135deg, #3a0a1a 0%, #8a1030 55%, #e2482f 100%)",
    accent: "#c21f3a",
    pairWord: "link-up",
    looking: "Looking for a link-up",
    unmask: "Reveal",
    gifts: ["fire", "cocktail", "diamond", "rose", "crown", "thumbsup"],
    chatBg: "midnight",
  },
};

export const moodOf = (intent?: Intent | null): Mood => MOODS[intent ?? "dating"] ?? MOODS.dating;

/** Gifts in mood order: the mood's picks first, then everything else as before */
export function giftsForMood<T extends { id: string }>(gifts: T[], intent?: Intent | null): T[] {
  if (!intent) return gifts;
  const order = moodOf(intent).gifts;
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return [...gifts].sort((a, b) => rank(a.id) - rank(b.id));
}
