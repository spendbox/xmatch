import type { Gender, Intent } from "./types";

// Masquerade: you're paired with someone who fits as soon as you're both online (up to one new pair an hour), 6am to 2am (Lagos time).

export type HourPair = {
  id: string;
  status: "active" | "matched" | "ended" | "lapsed";
  intent: Intent;
  ends_at: string;
  match_id: string | null;
  my_alias: string;
  their_alias: string;
  their_age: number | null;
  their_gender: Gender | null;
  their_place?: string | null;
  their_connections?: number;
  their_reply_seconds?: number | null;
  /** How close they are: same state, country, continent, or anywhere */
  their_tier?: "state" | "country" | "continent" | "world" | null;
  their_name: string | null;
  their_photo: string | null;
  my_vote: boolean | null;
  they_voted: boolean;
  messages: number;
  last_message: string | null;
  last_from_them: boolean | null;
  /** "text" or "audio" (a masked voice note) */
  last_kind?: string | null;
};

export type PastPair = {
  id: string;
  status: "lapsed" | "active";
  intent: Intent;
  hour_at: string;
  reopened_at: string | null;
  their_alias: string;
  their_age: number | null;
  their_gender: Gender | null;
  my_vote: boolean | null;
  last_message: string | null;
};

export type MasqueradeHour = {
  enabled: boolean;
  has_place?: boolean;
  server_now: string;
  hour_at: string;
  hour_open: boolean;
  hour_ran: boolean;
  pairs_this_hour: number;
  /** Live pairing: when you can next be paired (now, after the gap since your last pair, or when pairing hours start) */
  next_at: string;
  /** Live pairing: switched on and free to be paired right now ("Looking for your pair…") */
  looking?: boolean;
  /** People switched on and online right now: everywhere, in your country, in your state */
  pulse?: { all: number; country: number; region: number; region_name: string | null };
  invite_reward?: number;
  current: HourPair | null;
  past: PastPair[];
};

/** "7:00 PM" in Lagos time */
export function lagosTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
}

/** "7 PM" */
export function lagosHour(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "Africa/Lagos" });
}

/** "42:07" or "1:02:07" */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "in 23 min", "in 2h 5m" */
export function inTime(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  if (m < 60) return `in ${m} min`;
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "Today, 7 PM" / "Yesterday, 9 PM" / "Mon, 8 PM" */
export function whenPaired(iso: string, now = Date.now()) {
  const day = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const t = new Date(iso).getTime();
  const label =
    day(t) === day(now)
      ? "Today"
      : day(t) === day(now - 86_400_000)
        ? "Yesterday"
        : new Date(iso).toLocaleDateString("en-NG", { weekday: "short", timeZone: "Africa/Lagos" });
  return `${label}, ${lagosHour(iso)}`;
}

/** "Replies in minutes" etc., from someone's usual reply time */
export function replyLabel(secs: number | null | undefined) {
  if (secs == null) return "New here";
  if (secs < 5 * 60) return "⚡ Replies in minutes";
  if (secs < 60 * 60) return "Replies within the hour";
  if (secs < 6 * 3600) return "Replies in a few hours";
  return "Slow to reply";
}

/** "3 connections" */
export function connectionsLabel(n: number | null | undefined) {
  const c = n ?? 0;
  return c === 1 ? "1 connection" : `${c} connections`;
}
