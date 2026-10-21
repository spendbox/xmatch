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

export type DashpadEvent = {
  id: string;
  title: string;
  description: string;
  theme: EventTheme;
  intent: Intent;
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
