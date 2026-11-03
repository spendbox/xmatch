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

/** Someone who waved at you after you spilled: their answer and voice, by their mask name */
export type TruthWaver = {
  id: number;
  alias: string;
  choice: string;
  key: string | null;
  seconds: number | null;
  at: string;
  person: string;
  age: number | null;
  gender: string | null;
  /** You've waved back */
  waved: boolean;
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
    /** People who waved at you after you spilled (by their mask name here); before update 119 it's missing */
    wavers?: TruthWaver[];
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
        wavers: [
          { id: 21, alias: "Coral Heron", choice: "a", key: "", seconds: 13, at: "", person: "p6", age: 27, gender: "woman", waved: false },
          { id: 12, alias: "Quiet Storm", choice: "a", key: "", seconds: 11, at: "", person: "p2", age: 24, gender: "man", waved: true },
        ],
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

/** One of your past Spills (only you can see these) */
export type MySpill = {
  id: number;
  day: string;
  body: string;
  options: TruthOption[];
  choice: string;
  key: string | null;
  seconds: number | null;
  style: string | null;
  listens: number;
  hidden: boolean;
  total: number;
  /** How many picked what you picked */
  same: number;
  /** How many picked the most popular answer */
  top?: number;
};

export type SpillStats = {
  total: number;
  voices?: number;
  streak?: number;
  longest?: number;
  /** How often you picked what most people picked (%) */
  majority?: number;
  latest?: { day: string; body: string; answer: string | null } | null;
};

export type SpillFilter = "" | "voice" | "minority";

const DEMO_QS: [string, string[]][] = [
  ["Would you date someone who earns less than you?", ["Yes", "No"]],
  ["Would you rather text or call?", ["Text", "Call"]],
  ["Is a kiss on the first date too soon?", ["Yes", "No"]],
  ["Should couples share one bank account?", ["Yes, all of it", "Some of it", "No"]],
  ["Can men and women be just friends?", ["Yes", "No"]],
  ["Would you move abroad for love?", ["Yes", "No"]],
  ["Is it okay to check your partner's phone?", ["Yes", "No"]],
  ["Would you date someone with kids?", ["Yes", "No", "Maybe"]],
];

/** Previews: a few months of Spills */
export const DEMO_SPILLS: MySpill[] = Array.from({ length: 40 }, (_, i) => {
  const [body, labels] = DEMO_QS[i % DEMO_QS.length];
  const day = new Date(Date.UTC(2026, 10, 3) - i * 86400_000 * (i > 12 ? 2 : 1)).toISOString().slice(0, 10);
  const total = 2800 + ((i * 137) % 900);
  const top = Math.round(total * 0.64);
  const minority = i % 4 === 1;
  return {
    id: 100 - i,
    day,
    body,
    options: labels.map((label, k) => ({ id: "abcd"[k], label })),
    choice: minority ? "b" : "a",
    key: i % 3 === 0 ? "demo" : null,
    seconds: i % 3 === 0 ? 9 + (i % 14) : null,
    style: i % 3 === 0 ? (i % 2 ? "deep" : "normal") : null,
    listens: i % 3 === 0 ? 4 + ((i * 7) % 40) : 0,
    hidden: false,
    total,
    same: minority ? total - top : top,
    top,
  };
});

export const DEMO_SPILL_STATS: SpillStats = {
  total: 142,
  voices: 37,
  streak: 13,
  longest: 41,
  majority: 72,
  latest: { day: "2026-11-03", body: "Would you date someone who earns less than you?", answer: "Yes" },
};
