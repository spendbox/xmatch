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
};

export type MasqueradeState = {
  id: string;
  status: "active" | "matched" | "ended";
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
    has_voted: boolean;
    profile: { id: string; display_name: string; bio: string; photos: string[] } | null;
  };
};

export type MessageKind = "text" | "icebreaker" | "image" | "video" | "audio" | "call" | "gift" | "system";

export type MediaMeta = {
  width?: number;
  height?: number;
  duration?: number; // seconds
  mime?: string;
  call?: "audio" | "video";
  seconds?: number;
  gift?: string;
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
  last_sender: string | null;
  shared?: number;
  /** Something new from them since you last opened the chat */
  unread?: boolean;
};
