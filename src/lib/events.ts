import type { Intent } from "./types";

export type EventTheme = "violet" | "rose" | "gold" | "midnight" | "mint";

export const EVENT_THEMES: { value: EventTheme; label: string; bg: string; dot: string }[] = [
  { value: "violet", label: "Violet", bg: "from-brand via-[#6d4ff0] to-[#8f6bff]", dot: "bg-brand" },
  { value: "rose", label: "Rose", bg: "from-[#a3245a] via-[#c2306b] to-[#ff6b8b]", dot: "bg-[#c2306b]" },
  { value: "gold", label: "Gold", bg: "from-[#c06f12] via-[#e8962a] to-[#f2b33d]", dot: "bg-gold" },
  { value: "midnight", label: "Midnight", bg: "from-ink via-[#2b2148] to-[#4a2f86]", dot: "bg-ink" },
  { value: "mint", label: "Mint", bg: "from-[#0f6b4f] via-[#15845f] to-[#2bb583]", dot: "bg-mint" },
];

export const themeBg = (t: string) => EVENT_THEMES.find((x) => x.value === t)?.bg ?? EVENT_THEMES[0].bg;

/** masquerade = we pair you (masked rounds); spotlight / party = you pick who to talk to from a wall of featured photos */
export type EventKind = "masquerade" | "spotlight" | "party";

export const EVENT_KINDS: { value: EventKind; label: string; short: string; hint: string; auto: boolean }[] = [
  { value: "masquerade", label: "Masquerade Night", short: "Masquerade", hint: "We pair people in masked 5-minute rounds", auto: true },
  { value: "spotlight", label: "Spotlight Night", short: "Spotlight", hint: "Guests browse featured photos and pick who to chat with", auto: false },
  { value: "party", label: "Listening Party", short: "Party", hint: "Music or video is the main show; guests chat in the room and in private", auto: false },
];
export const kindLabel = (k?: string) => EVENT_KINDS.find((x) => x.value === k)?.label ?? "Masquerade Night";
export const isChooseKind = (k?: string) => k === "spotlight" || k === "party";

/** Per-event options stored in masquerade_events.settings. Missing keys use these defaults. */
export type EventSettings = {
  room_chat?: boolean; // default true
  slow_mode?: number; // seconds between room messages per person, default 0
  hype?: boolean; // hype reactions, default true
  max_chats?: number; // chats a person can start, default 5
  free_reveals?: number; // free photo reveals per person, default 10
  reveal_cost?: number; // Keys per reveal after the free ones, default 1
  media_under_chats?: boolean; // keep music/video playing in private chats, default true
  show_video?: boolean; // show the picture of videos and links; off = sound only, default true
  reminders?: boolean; // reminder emails, default true
};
export const SETTING_DEFAULTS: Required<EventSettings> = {
  room_chat: true,
  slow_mode: 0,
  hype: true,
  max_chats: 5,
  free_reveals: 10,
  reveal_cost: 1,
  media_under_chats: true,
  show_video: true,
  reminders: true,
};
export const settingsOf = (e: { settings?: EventSettings | null }): Required<EventSettings> => ({ ...SETTING_DEFAULTS, ...(e.settings ?? {}) });

export type EventMedia = { id: number; kind: "audio" | "video"; title: string; url: string; duration_sec: number };

export const HYPE_REACTIONS = ["🔥", "😍", "😂", "👏", "💃", "🎉", "💜", "🙌"] as const;

export type DashpadEvent = {
  id: string;
  title: string;
  description: string;
  theme: EventTheme;
  intent: Intent;
  kind: EventKind;
  cover_url: string | null;
  /** Live stream or video link (YouTube, .m3u8, .mp4, .mp3) */
  stream_url: string | null;
  settings: EventSettings;
  media: EventMedia[];
  my_photo: string | null;
  my_chats: number;
  reveals_used: number;
  starts_at: string;
  ends_at: string;
  age_min: number;
  age_max: number;
  entry_keys: number;
  max_attendees: number | null;
  status: "published" | "cancelled" | "draft";
  going_count: number;
  i_am_going: boolean;
  my_rounds: number;
  my_unmasks: number;
  server_now: string;
};

export type EventPhase = "upcoming" | "live" | "ended" | "cancelled";

export function eventPhase(e: { starts_at: string; ends_at: string; status: string }, now = Date.now()): EventPhase {
  if (e.status === "cancelled") return "cancelled";
  if (now < new Date(e.starts_at).getTime()) return "upcoming";
  if (now < new Date(e.ends_at).getTime()) return "live";
  return "ended";
}

export function countdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function eventWhen(iso: string, endIso?: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!endIso) return `${day} · ${t}`;
  const e = new Date(endIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t} – ${e}`;
}

/** Someone on the wall at a "you choose" event. photo is null until you reveal it; blur is a tiny blurred preview. */
export type WallPerson = {
  user_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  blur: string | null;
  photo: string | null;
  revealed: boolean;
  shared: number;
  interests: string[];
  chat_id: string | null;
};

export type EventChatSummary = {
  id: string;
  status: "open" | "matched" | "closed";
  created_at: string;
  last_message_at: string;
  opened_by: string;
  my_keep: boolean | null;
  other_id: string;
  name: string;
  age: number | null;
  gender?: string | null;
  blur: string | null;
  photo: string | null;
  last_message: string | null;
  last_sender: string | null;
};

export type EventChatMessage = { id: number; sender_id: string; body: string; created_at: string };

export type EventChatDetail = {
  id: string;
  event_id: string;
  status: "open" | "matched" | "closed";
  match_id: string | null;
  my_keep: boolean | null;
  their_keep_set: boolean;
  event: DashpadEvent;
  other: { id: string; name: string; age: number | null; gender: string | null; interests: string[]; blur: string | null; photo: string | null };
  messages: EventChatMessage[];
};

export type RoomMessage = {
  id: number;
  user_id: string | null;
  kind: "text" | "hype" | "announce" | "moment";
  body: string;
  created_at: string;
  name: string;
};
