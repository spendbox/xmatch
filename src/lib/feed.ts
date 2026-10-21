// The Feed: one Daily Prompt for everyone, answered masked.

export const REACTIONS = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "laugh", emoji: "😂", label: "Funny" },
  { key: "hundred", emoji: "💯", label: "So true" },
  { key: "eyes", emoji: "👀", label: "Interesting" },
  { key: "wow", emoji: "🤯", label: "Wow" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

export type FeedPrompt = { id: string; body: string; day: string; chat_cost: number; answers: number };

export type FeedAnswer = {
  id: string;
  alias: string;
  body: string;
  created_at: string;
  age: number | null;
  gender: string | null;
  mine: boolean;
  reactions: Partial<Record<ReactionKey, number>>;
  my_reaction: ReactionKey | null;
  gifts: number;
  chat_id: string | null;
  can_chat: boolean;
  matched: boolean;
};

export type MyAnswer = {
  id: string;
  alias: string;
  body: string;
  created_at: string;
  hidden: boolean;
  reactions: number;
  gifts: number;
  chats: number;
};

export type Feed = {
  prompt: FeedPrompt | null;
  my_answer?: MyAnswer | null;
  answers?: FeedAnswer[];
  gifts_unseen: number;
};

export type FeedGift = {
  id: number;
  gift_id: string;
  created_at: string;
  seen_at: string | null;
  answer_body: string | null;
  prompt_body: string | null;
  from_id: string;
  from_name: string | null;
  from_photo: string | null;
  from_age: number | null;
  from_gender: string | null;
  chat_id: string | null;
  can_chat: boolean;
  match_id: string | null;
};

export type FeedPerson = {
  id: string;
  name: string | null;
  masked: boolean;
  photo: string | null;
  age: number | null;
  gender: string | null;
  interests?: string[] | null;
};

export type FeedChatMessage = { id: number; sender_id: string; body: string; created_at: string };

export type FeedChatDetail = {
  id: string;
  status: "open" | "matched";
  match_id: string | null;
  opened_by: string;
  created_at: string;
  expires_at: string;
  decide_by: string;
  prompt_body: string | null;
  answer_body: string | null;
  answer_mine: boolean;
  my_keep: boolean | null;
  their_keep_set: boolean;
  me: FeedPerson;
  other: FeedPerson;
  messages: FeedChatMessage[];
};

export type FeedChatSummary = {
  id: string;
  expires_at: string;
  last_message_at: string;
  prompt_body: string | null;
  other: FeedPerson;
  last_message: string | null;
  unread: boolean;
};

export const totalReactions = (r: FeedAnswer["reactions"]) => Object.values(r).reduce((a, b) => a + (b ?? 0), 0);

/** Turns database error codes into friendly messages. */
export function feedError(msg?: string | null) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("NOT_ENOUGH_KEYS")) return "You don't have enough Keys for that.";
  if (msg.includes("ALREADY_MATCHED")) return "You're already matched with this person. Find them in Chats.";
  if (msg.includes("TOO_MANY_CHATS")) return "You've started a lot of chats today. Try again tomorrow.";
  if (msg.includes("closed")) return "Today's prompt has closed. A new one is up.";
  if (msg.includes("Not available")) return "This person isn't available to chat.";
  if (msg.includes("row-level security")) return "This chat has ended.";
  if (msg.includes("500 characters")) return "Keep it under 500 characters.";
  return "Something went wrong. Please try again.";
}

/** "3h left", "25m left" */
export function timeLeft(ms: number) {
  if (ms <= 0) return "Ended";
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m}m left`;
  return `${Math.floor(m / 60)}h left`;
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
