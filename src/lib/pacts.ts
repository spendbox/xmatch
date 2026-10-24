/**
 * Pacts: an admin's questionnaire event. People answer (no account needed), and on
 * reveal night everyone gets their one best match for business, friendship, love or
 * something spicy. Shared by the pact pages, the admin and the matching job.
 */

export type PactIntent = "business" | "friendship" | "love" | "spicy";
export type QuestionKind = "this_or_that" | "choose_one" | "choose_many" | "scale";
export type Weight = "normal" | "strong" | "dealbreaker";

export type PactOption = { id: string; label: string; image?: string | null };
export type PactQuestion = {
  id: string;
  position: number;
  kind: QuestionKind;
  title: string;
  subtitle: string;
  options: PactOption[];
  min_pick: number;
  max_pick: number;
  weight: Weight;
};
export type Pact = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  header_url: string | null;
  accent: string;
  intents: PactIntent[];
  areas: string[];
  email_domain: string | null;
  closes_at: string;
  reveal_at: string;
  status: "draft" | "live" | "revealed";
  matched_at: string | null;
};

/** One answer: an option id, several option ids, or 1 to 5 on a scale */
export type Answer = string | string[] | number;
export type Answers = Record<string, Answer>;
export type About = {
  gender: "woman" | "man";
  intents: PactIntent[];
  /** Who they'd like to meet for love or something spicy */
  seeking: ("woman" | "man")[];
  age: number;
  ageMin: number;
  ageMax: number;
  area?: string;
  /** What they do, for business matches */
  work?: string;
};

export const INTENTS: { id: PactIntent; label: string; note: string }[] = [
  { id: "business", label: "Business", note: "Partners, clients, mentors" },
  { id: "friendship", label: "Friendship", note: "Your kind of people" },
  { id: "love", label: "Love", note: "Someone special" },
  { id: "spicy", label: "Something spicy", note: "Keep it fun" },
];
export const intentLabel = (i: PactIntent) => INTENTS.find((x) => x.id === i)?.label ?? i;

export const WORK = ["Tech", "Finance", "Creative & media", "Fashion & beauty", "Food & hospitality", "Health", "Law", "Real estate", "Trading & retail", "Oil, gas & energy", "Public service", "Student", "Building my own thing", "Something else"];

export const KIND_LABEL: Record<QuestionKind, string> = {
  this_or_that: "This or that",
  choose_one: "Pick one",
  choose_many: "Pick a few",
  scale: "Slider",
};
export const WEIGHT_LABEL: Record<Weight, string> = { normal: "Normal", strong: "Strong", dealbreaker: "Deal-breaker" };
const WEIGHT_VALUE: Record<Weight, number> = { normal: 1, strong: 2, dealbreaker: 3 };

const opts = (...labels: string[]): PactOption[] => labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label }));

/** The questions every new pact starts with. Admins can remove, reorder, edit and add. */
export const SEED_QUESTIONS: Omit<PactQuestion, "id" | "position">[] = [
  { kind: "this_or_that", title: "Your ideal Friday night", subtitle: "", options: opts("Owambe till 3am", "Movie and suya at home"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Money", subtitle: "", options: opts("Save it for the future", "Spend it on memories"), min_pick: 1, max_pick: 1, weight: "strong" },
  { kind: "this_or_that", title: "Your hustle", subtitle: "", options: opts("Building my own thing", "Rising in a great company"), min_pick: 1, max_pick: 1, weight: "strong" },
  { kind: "this_or_that", title: "When you disagree", subtitle: "", options: opts("Talk it out right now", "Cool off, talk tomorrow"), min_pick: 1, max_pick: 1, weight: "strong" },
  { kind: "this_or_that", title: "Five years from now", subtitle: "", options: opts("Still in Lagos", "Living abroad"), min_pick: 1, max_pick: 1, weight: "strong" },
  { kind: "choose_many", title: "Your top artists", subtitle: "Pick up to 5", options: opts("Burna Boy", "Wizkid", "Davido", "Tems", "Asake", "Rema", "Ayra Starr", "Olamide", "Tiwa Savage", "Fireboy DML", "Omah Lay", "Seyi Vibez", "Kizz Daniel", "Adekunle Gold", "Simi", "Shallipopi"), min_pick: 1, max_pick: 5, weight: "normal" },
  { kind: "choose_one", title: "Sunday afternoon, you're…", subtitle: "", options: opts("At church or the mosque", "At brunch with friends", "Asleep, recovering", "Working on my side hustle", "At the beach"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "scale", title: "How social are you?", subtitle: "", options: opts("Homebody", "Life of the party"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Faith", subtitle: "", options: opts("A big part of my life", "Personal and private"), min_pick: 1, max_pick: 1, weight: "dealbreaker" },
  { kind: "this_or_that", title: "Jollof", subtitle: "", options: opts("Party jollof, smoky", "Home jollof, mama's way"), min_pick: 1, max_pick: 1, weight: "normal" },
];

export const MAX_QUESTIONS = 25;

// ---------------------------------------------------------------- checking what people send

/** Returns the cleaned answers, or a message saying what's wrong */
export function cleanAnswers(questions: PactQuestion[], raw: unknown): Answers | string {
  if (!raw || typeof raw !== "object") return "Please answer the questions.";
  const input = raw as Record<string, unknown>;
  const out: Answers = {};
  for (const q of questions) {
    const v = input[q.id];
    const ids = new Set(q.options.map((o) => o.id));
    if (q.kind === "scale") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) return `Please answer "${q.title}".`;
      out[q.id] = n;
    } else if (q.kind === "choose_many") {
      if (!Array.isArray(v)) return `Please answer "${q.title}".`;
      const picked = [...new Set(v.filter((x): x is string => typeof x === "string" && ids.has(x)))];
      if (picked.length < Math.max(1, q.min_pick) || picked.length > Math.max(1, q.max_pick)) return `Pick between ${q.min_pick} and ${q.max_pick} for "${q.title}".`;
      out[q.id] = picked;
    } else {
      if (typeof v !== "string" || !ids.has(v)) return `Please answer "${q.title}".`;
      out[q.id] = v;
    }
  }
  return out;
}

export function cleanAbout(pact: Pick<Pact, "intents" | "areas">, raw: unknown): About | string {
  const a = (raw ?? {}) as Record<string, unknown>;
  const gender = a.gender === "woman" || a.gender === "man" ? a.gender : null;
  if (!gender) return "Tell us if you're a woman or a man.";
  const intents = (Array.isArray(a.intents) ? a.intents : []).filter((i): i is PactIntent => pact.intents.includes(i as PactIntent));
  if (!intents.length) return "Pick what you're here for.";
  const seeking = (Array.isArray(a.seeking) ? a.seeking : []).filter((g): g is "woman" | "man" => g === "woman" || g === "man");
  const romantic = intents.includes("love") || intents.includes("spicy");
  if (romantic && !seeking.length) return "Tell us who you'd like to meet.";
  const age = Math.round(Number(a.age));
  if (!Number.isFinite(age) || age < 18 || age > 99) return "You need to be 18 or older to join a pact.";
  let ageMin = Math.round(Number(a.ageMin)), ageMax = Math.round(Number(a.ageMax));
  if (!Number.isFinite(ageMin)) ageMin = 18;
  if (!Number.isFinite(ageMax)) ageMax = 99;
  ageMin = Math.max(18, Math.min(99, ageMin));
  ageMax = Math.max(ageMin, Math.min(99, ageMax));
  const area = typeof a.area === "string" && pact.areas.includes(a.area) ? a.area : undefined;
  if (pact.areas.length && !area) return "Pick your area.";
  const work = typeof a.work === "string" && WORK.includes(a.work) ? a.work : undefined;
  if (intents.includes("business") && !work) return "Tell us what you do.";
  return { gender, intents, seeking: romantic ? seeking : [], age, ageMin, ageMax, area, work };
}

// ---------------------------------------------------------------- matching

export type Entry = { id: string; about: About; answers: Answers };
export type Pair = { a: string; b: string; score: number; intent: PactIntent; shared: { q: string; a: string }[]; differ: { q: string; a: string; b: string } | null };

// When two people want several of the same things, the match is labelled with the first that fits
const PRIORITY: PactIntent[] = ["love", "spicy", "business", "friendship"];

function wants(x: About, y: About) {
  return x.seeking.includes(y.gender);
}

/** The thing these two would be matched for, or null if they can't be matched */
export function matchIntent(x: About, y: About): PactIntent | null {
  if (x.age < y.ageMin || x.age > y.ageMax || y.age < x.ageMin || y.age > x.ageMax) return null;
  for (const i of PRIORITY) {
    if (!x.intents.includes(i) || !y.intents.includes(i)) continue;
    if ((i === "love" || i === "spicy") && !(wants(x, y) && wants(y, x))) continue;
    return i;
  }
  return null;
}

const label = (q: PactQuestion, id: string) => q.options.find((o) => o.id === id)?.label ?? "";

/** How alike two people are (0 to 100), plus what they share. null if a deal-breaker splits them. */
export function compare(questions: PactQuestion[], x: Entry, y: Entry, intent: PactIntent) {
  let got = 0;
  let max = 0;
  const shared: { q: string; a: string; w: number }[] = [];
  let differ: Pair["differ"] = null;
  const romantic = intent === "love" || intent === "spicy";
  for (const q of questions) {
    const ax = x.answers[q.id], ay = y.answers[q.id];
    if (ax === undefined || ay === undefined) continue;
    // Deal-breakers only rule people out for love or something spicy; elsewhere they just count a lot
    const w = WEIGHT_VALUE[q.weight];
    max += w;
    if (q.kind === "scale") {
      const s = 1 - Math.abs(Number(ax) - Number(ay)) / 4;
      got += w * s;
      if (s === 1) shared.push({ q: q.title, a: Number(ax) <= 2 ? q.options[0]?.label : Number(ax) >= 4 ? q.options[1]?.label : "Right in the middle", w });
    } else if (q.kind === "choose_many") {
      const sx = new Set(ax as string[]), sy = new Set(ay as string[]);
      const both = [...sx].filter((v) => sy.has(v));
      const union = new Set([...sx, ...sy]).size || 1;
      got += w * Math.min(1, (both.length / union) * 1.6);
      if (both.length) shared.push({ q: q.title, a: both.slice(0, 3).map((id) => label(q, id)).join(", "), w: w + both.length * 0.2 });
    } else if (ax === ay) {
      got += w;
      shared.push({ q: q.title, a: label(q, ax as string), w });
    } else {
      if (q.weight === "dealbreaker" && romantic) return null;
      if (!differ || q.weight !== "normal") differ = { q: q.title, a: label(q, ax as string), b: label(q, ay as string) };
    }
  }
  // A little extra for being in the same area, and for business, the same line of work
  let bonus = 0;
  if (x.about.area && x.about.area === y.about.area) bonus += 0.04;
  if (intent === "business" && x.about.work && x.about.work === y.about.work) bonus += 0.03;
  const score = Math.round(Math.min(1, (max ? got / max : 0.5) + bonus) * 100);
  shared.sort((p, q) => q.w - p.w);
  return { score, shared: shared.slice(0, 4).map(({ q, a }) => ({ q, a })), differ };
}

/**
 * Pairs everyone up so the pact as a whole gets the best matches: each person's 25 best
 * candidates are found, then the strongest pairs are taken first.
 */
export function matchEveryone(questions: PactQuestion[], entries: Entry[]): Pair[] {
  const KEEP = 25;
  const best = new Map<string, { other: number; score: number }[]>();
  const edges: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const intent = matchIntent(entries[i].about, entries[j].about);
      if (!intent) continue;
      const c = compare(questions, entries[i], entries[j], intent);
      if (!c) continue;
      for (const [me, other] of [[i, j], [j, i]] as const) {
        const list = best.get(entries[me].id) ?? [];
        list.push({ other, score: c.score });
        if (list.length > KEEP * 2) { list.sort((p, q) => q.score - p.score); list.length = KEEP; }
        best.set(entries[me].id, list);
      }
    }
  }
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const list = (best.get(entries[i].id) ?? []).sort((p, q) => q.score - p.score).slice(0, KEEP);
    for (const { other, score } of list) {
      const key = i < other ? `${i}:${other}` : `${other}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ i: Math.min(i, other), j: Math.max(i, other), score });
    }
  }
  edges.sort((p, q) => q.score - p.score);
  const taken = new Set<number>();
  const pairs: Pair[] = [];
  for (const e of edges) {
    if (taken.has(e.i) || taken.has(e.j)) continue;
    taken.add(e.i);
    taken.add(e.j);
    const x = entries[e.i], y = entries[e.j];
    const intent = matchIntent(x.about, y.about)!;
    const c = compare(questions, x, y, intent)!;
    pairs.push({ a: x.id, b: y.id, score: c.score, intent, shared: c.shared, differ: c.differ });
  }
  return pairs;
}

// ---------------------------------------------------------------- answers as "things about you"

/** Short lines for someone's profile, e.g. "Your ideal Friday night: Movie and suya at home" */
export function answersAsThings(questions: PactQuestion[], answers: Answers): string[] {
  const out: string[] = [];
  for (const q of questions) {
    const v = answers[q.id];
    if (v === undefined || q.kind === "scale") continue;
    const text = Array.isArray(v) ? v.map((id) => label(q, id)).filter(Boolean).join(", ") : label(q, v as string);
    if (!text) continue;
    // "Sunday afternoon, you're…" runs straight into the answer; other titles take a colon
    const line = /…$/.test(q.title) ? `${q.title.replace(/…$/, "")} ${text.charAt(0).toLowerCase()}${text.slice(1)}` : `${q.title.replace(/[.:?]+$/, "")}: ${text}`;
    out.push(line.slice(0, 60));
  }
  return out;
}

// ---------------------------------------------------------------- dates

export type Phase = "open" | "closed" | "revealed";
export function pactPhase(p: Pick<Pact, "closes_at" | "reveal_at" | "status">, now = Date.now()): Phase {
  if (p.status === "revealed" || now >= new Date(p.reveal_at).getTime()) return "revealed";
  if (now >= new Date(p.closes_at).getTime()) return "closed";
  return "open";
}
