/**
 * Truths: one bold question a day for everyone ("Would you date someone who earns less than you?").
 * Answer it, say why in a masked voice note if you like, then see how everyone answered, listen to
 * other people's voice answers and wave at someone. If you both wave, a masked chat opens.
 */

export type TruthOption = { id: string; label: string };

export type TruthVoice = {
  id: number;
  alias: string;
  choice: string;
  key: string;
  seconds: number;
  listens: number;
  at: string;
  /** Who it is (only used to wave at them) */
  person: string;
  same: boolean;
  age: number | null;
  gender: string | null;
  waved: boolean;
  can_wave: boolean;
};

export type Truth = {
  none?: boolean;
  id: number;
  body: string;
  options: TruthOption[];
  day: string;
  ends_at: string;
  total: number;
  streak: number;
  mine: { choice: string; alias: string; key: string | null; seconds: number | null; listens: number } | null;
  results: {
    counts: Record<string, number>;
    women: Record<string, number>;
    men: Record<string, number>;
    voices: TruthVoice[];
    waves: number;
  } | null;
};

/** "5h 20m" until the next Truth */
export function timeLeft(endsAt: string, now = Date.now()) {
  const m = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** What share of answers picked each option, as whole percentages */
export function shares(counts: Record<string, number>, options: TruthOption[]) {
  const total = options.reduce((s, o) => s + (counts[o.id] ?? 0), 0);
  return Object.fromEntries(options.map((o) => [o.id, total ? Math.round(((counts[o.id] ?? 0) / total) * 100) : 0])) as Record<string, number>;
}

// ---- Previews ----
const soon = () => new Date(Date.now() + 5 * 3600_000 + 20 * 60_000).toISOString();
export const DEMO_TRUTH = (answered: boolean): Truth => ({
  id: 1,
  body: "Would you date someone who earns less than you?",
  options: [
    { id: "a", label: "Yes" },
    { id: "b", label: "No" },
  ],
  day: "2026-11-03",
  ends_at: soon(),
  total: 3412,
  streak: answered ? 13 : 12,
  mine: answered ? { choice: "a", alias: "Golden Fox", key: "demo", seconds: 14, listens: 14 } : null,
  results: answered
    ? {
        counts: { a: 2184, b: 1228 },
        women: { a: 1120, b: 460 },
        men: { a: 1064, b: 768 },
        waves: 2,
        voices: [
          { id: 11, alias: "Velvet Owl", choice: "a", key: "", seconds: 18, listens: 42, at: "", person: "p1", same: true, age: 26, gender: "woman", waved: false, can_wave: true },
          { id: 12, alias: "Quiet Storm", choice: "a", key: "", seconds: 11, listens: 30, at: "", person: "p2", same: true, age: 24, gender: "man", waved: true, can_wave: true },
          { id: 13, alias: "Amber Lion", choice: "a", key: "", seconds: 24, listens: 19, at: "", person: "p3", same: true, age: 29, gender: "woman", waved: false, can_wave: true },
          { id: 14, alias: "Blue Heron", choice: "b", key: "", seconds: 21, listens: 51, at: "", person: "p4", same: false, age: 31, gender: "man", waved: false, can_wave: true },
          { id: 15, alias: "Silver Moth", choice: "b", key: "", seconds: 9, listens: 12, at: "", person: "p5", same: false, age: 27, gender: "woman", waved: false, can_wave: true },
        ],
      }
    : null,
});

/** The kinds of Truth (for Admin; they're spread over the year so no week feels the same) */
export const TRUTH_KINDS: Record<string, string> = {
  light: "Light",
  real: "Real talk",
  spicy: "Spicy",
  deep: "Deep",
  society: "Society",
};

/** A Truth as Admin sees it */
export type TruthRow = { id: number; day: string | null; body: string; options: TruthOption[]; kind: string; active: boolean };
export type TruthStats = Record<string, { total: number; voices: number; counts: Record<string, number> }>;
