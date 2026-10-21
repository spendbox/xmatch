export type Gender = "woman" | "man" | "other";
export type Intent = "friends" | "dating" | "spicy";
export type Seeking = "women" | "men" | "anyone";

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

export type ChatMessage = {
  id: number;
  sender_id: string | null;
  kind?: "text" | "icebreaker";
  body: string;
  created_at: string;
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
};
