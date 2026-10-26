export type Gender = "woman" | "man" | "other";
export type Intent = "friends" | "dating" | "spicy";
/** Who someone wants to meet: one or two of SeekKey joined by commas (e.g. "women,other"), or "anyone". */
export type SeekKey = "women" | "men" | "other";
export type Seeking = string;

export type Profile = {
  id: string;
  display_name: string | null;
  birthdate: string | null;
  gender: Gender | null;
  bio: string;
  interests: string[];
  photos: string[];
  open_to_masquerade: boolean;
  pref_intent: Intent;
  pref_seeking: Seeking;
  pref_age_min: number;
  pref_age_max: number;
  pref_spice: number;
  pref_max_km: number | null;
  place_country?: string | null;
  place_region?: string | null;
  place_label?: string | null;
  /** Ghost mode: hidden from the Meet page while it lasts */
  ghost_on?: boolean;
  /** "Things about me" cards: prompt id and answer */
  things?: { p: string; a: string }[];
  ghost_until?: string | null;
};

export type MasqueradeState = {
  id: string;
  /** lapsed = an hourly pair whose hour ended with no decision (kept as a past pair) */
  status: "active" | "matched" | "ended" | "lapsed";
  /** Paired on the hour (not an event round) */
  hourly?: boolean;
  /** Reopened with Keys: open until both decide */
  reopened?: boolean;
  /** Started from Meet (open until you both unmask) */
  explore?: boolean;
  /** Paired by Play for a game */
  play?: boolean;
  /** Opened from a meet (hourly is also true: decide any time) */
  meet?: {
    id: string;
    kind: "game" | "text";
    game: string | null;
    /** You posted it */
    mine: boolean;
    /** A game meet whose game in this chat hasn't been played yet */
    turn_pending: boolean;
    /** Game meets: people ahead of you in line (people waiting, if it's yours) */
    ahead: number | null;
    /** Your meet: your game is happening in another of its chats */
    live_chat: { id: string; alias: string; status: "invited" | "active" } | null;
  } | null;
  ended_reason: string | null;
  intent: Intent;
  spice_level: number;
  started_at: string;
  ends_at: string;
  server_now: string;
  match_id: string | null;
  me: { id: string; alias: string; spice: number; vote: boolean | null };
  them: {
    alias: string;
    spice: number;
    age: number;
    gender: Gender;
    interests: string[];
    shared_interests: string[];
    distance_km: number | null;
    /** "Lagos, Nigeria" */
    place?: string | null;
    same_place?: boolean | null;
    connections?: number;
    reply_seconds?: number | null;
    has_voted: boolean;
    /** Words you both used in "things about me" */
    shared_words?: string[];
    /** In the app right now */
    online?: boolean;
    /** Minutes since they were last in the app */
    seen_minutes?: number | null;
    profile: { id: string; display_name: string; bio: string; photos: string[] } | null;
  };
};

export type MessageKind = "text" | "icebreaker" | "image" | "video" | "audio" | "call" | "gift" | "system" | "game" | "meet" | "masked" | "sticker";

export type MediaMeta = {
  /** Masked voice notes: where the file is stored (played from our storage address), and once it's been deleted */
  key?: string;
  expired?: boolean;
  voice?: string;
  expires_at?: string;
  width?: number;
  height?: number;
  duration?: number; // seconds
  mime?: string;
  /** Slow reveals: a tiny blurry preview the other person can see before it clears */
  preview?: string;
  call?: "audio" | "video";
  seconds?: number;
  gift?: string;
  /** Game result cards */
  game?: string;
  kind?: string;
  a?: string;
  b?: string;
  sa?: number;
  sb?: number;
  winner?: string | null;
  status?: string;
  reason?: string | null;
  by?: string | null;
  /** The meet a masked chat was opened from: who posted it */
  alias?: string;
  /** Stickers: Masky's pose and colour (the words are the message body) */
  pose?: string;
  color?: string;
};

export type ChatMessage = {
  id: number;
  sender_id: string | null;
  kind?: MessageKind;
  body: string;
  created_at: string;
  media_path?: string | null;
  media_meta?: MediaMeta | null;
  reply_to?: number | null;
  deleted_at?: string | null;
  /** A slow reveal photo or video: blurred for the other person until you've both chatted (or they pay) */
  slow?: boolean;
  slow_paid_at?: string | null;
  /** Who reacted with what: { [person]: "😂" } (update 92) */
  reactions?: Record<string, string> | null;
  /** When the words were last changed (update 92) */
  edited_at?: string | null;
  /** Only on the sender's screen while a file is still uploading */
  local_url?: string;
  pending?: boolean;
  failed?: boolean;
};

export type MatchSummary = {
  id: string;
  created_at: string;
  last_message_at: string;
  intent: Intent;
  other_id: string;
  display_name: string;
  photos: string[];
  age: number;
  last_message: string | null;
  /** What the last message was (voice note, gift…), so the list can say so (update 91) */
  last_kind?: string | null;
  last_deleted?: boolean | null;
  last_sender: string | null;
  shared?: number;
  /** Something new from them since you last opened the chat */
  unread?: boolean;
};
