import type { Gender } from "@/lib/types";
import type { GameKind } from "@/lib/games";

/** A post on Home and Meet: a game challenge or a line of text, up for a few hours */
export type Meet = {
  id: string;
  kind: "game" | "text";
  game: GameKind | null;
  body: string;
  /** The mask name of the person who posted it */
  alias: string;
  created_at: string;
  ends_at: string;
  mine: boolean;
  age: number | null;
  gender: Gender | null;
  /** Your chat from this meet, if you already tapped Meet */
  session_id: string | null;
  /** How many people have met them from it */
  people: number;
  /** Your own game meet: people still waiting for their game */
  waiting: number | null;
};

export type MeetList = {
  server_now: string;
  /** What posting costs you right now (0 = free) */
  cost: number;
  hours: number;
  mine: Meet | null;
  posts: Meet[];
};

/** One of your chats from a meet (yours or someone else's) */
export type MeetChat = {
  id: string;
  status: "active" | "lapsed";
  ends_at: string;
  /** You posted the meet */
  mine: boolean;
  kind: "game" | "text";
  game: GameKind | null;
  post: string;
  their_alias: string;
  my_vote: boolean | null;
  game_status: "invited" | "active" | null;
  /** A game meet whose game hasn't been played yet */
  in_line: boolean;
  last_message: string | null;
};

/** "2h 40m left" */
export function meetLeft(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ended";
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m left` : `${h}h left`;
}

export function meetError(message: string | undefined) {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("NOT_ENOUGH_KEYS")) return "You don't have enough Keys for that.";
  const known = [
    "You already have a meet up",
    "Finish your profile first",
    "Pick a game",
    "Write something first",
    "Keep it under 140 characters",
    "Keep your line under 80 characters",
    "This game is taking a break",
    "This meet has ended",
    "This meet is gone",
    "This meet isn’t open to you",
    "Slow down a little",
  ];
  const hit = known.find((k) => message.includes(k));
  return hit ? message : "Something went wrong. Please try again.";
}
