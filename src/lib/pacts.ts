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

const opts = (...labels: string[]): PactOption[] => labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label, ...(SEED_ART[label] ? { image: art(SEED_ART[label]) } : {}) }));

/** Drawings that come with Dashpad (in public/pacts/art), for answers. Admins can pick any of them. */
export const ART_LIBRARY: { name: string; label: string }[] = [
  { name: "owambe", label: "Party" }, { name: "movie-suya", label: "Movie night" }, { name: "save", label: "Saving" }, { name: "spend", label: "Memories" },
  { name: "own-thing", label: "Rocket" }, { name: "company", label: "Office" }, { name: "talk-now", label: "Talking" }, { name: "cool-off", label: "Sleep on it" },
  { name: "lagos", label: "Lagos" }, { name: "abroad", label: "Abroad" }, { name: "faith-big", label: "Glowing heart" }, { name: "faith-private", label: "Candle" },
  { name: "party-jollof", label: "Party jollof" }, { name: "home-jollof", label: "Home jollof" }, { name: "worship", label: "Worship" }, { name: "brunch", label: "Brunch" },
  { name: "asleep", label: "Asleep" }, { name: "side-hustle", label: "Side hustle" }, { name: "beach", label: "Beach" }, { name: "coffee", label: "Coffee" },
  { name: "tea", label: "Tea" }, { name: "dog", label: "Dog" }, { name: "cat", label: "Cat" }, { name: "early-bird", label: "Early bird" },
  { name: "night-owl", label: "Night owl" }, { name: "texting", label: "Texting" }, { name: "calling", label: "Calling" }, { name: "books", label: "Books" },
  { name: "gym", label: "Gym" }, { name: "couch", label: "Couch" }, { name: "football", label: "Football" }, { name: "music", label: "Music" },
  { name: "city", label: "City" }, { name: "village", label: "Village" }, { name: "sweet", label: "Sweet" }, { name: "spicy", label: "Spicy" },
  { name: "anime", label: "Anime" }, { name: "games", label: "Games" },
];
export const art = (name: string) => `/pacts/art/${name}.svg`;

/** Which drawing goes with each ready-made answer */
const SEED_ART: Record<string, string> = {
  "Owambe till 3am": "owambe", "Movie and suya at home": "movie-suya",
  "Save it for the future": "save", "Spend it on memories": "spend",
  "Building my own thing": "own-thing", "Rising in a great company": "company",
  "Talk it out right now": "talk-now", "Cool off, talk tomorrow": "cool-off",
  "Still in Lagos": "lagos", "Living abroad": "abroad",
  "A big part of my life": "faith-big", "Personal and private": "faith-private",
  "Party jollof, smoky": "party-jollof", "Home jollof, mama's way": "home-jollof",
  "Anime marathon": "anime", "A good movie": "movie-suya",
  "Early bird": "early-bird", "Night owl": "night-owl",
  "Coffee": "coffee", "Tea": "tea", "Dogs": "dog", "Cats": "cat",
  "Texting all day": "texting", "Long phone calls": "calling",
  "Hitting the gym": "gym", "Chilling on the couch": "couch",
  "A beach resort": "beach", "Exploring a new city": "city",
  "At church or the mosque": "worship", "At brunch with friends": "brunch", "Asleep, recovering": "asleep", "Working on my side hustle": "side-hustle", "At the beach": "beach",
};

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
  { kind: "this_or_that", title: "Anime or movies?", subtitle: "", options: opts("Anime marathon", "A good movie"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "choose_many", title: "Games you love", subtitle: "Pick up to 4", options: opts("EA FC (FIFA)", "Call of Duty", "PUBG or Free Fire", "Fortnite", "GTA", "Mortal Kombat", "Minecraft", "Chess", "Ludo", "Whot", "Scrabble", "Card games", "Board games with friends", "I don't really play games"), min_pick: 1, max_pick: 4, weight: "normal" },
  { kind: "choose_many", title: "What you watch", subtitle: "Pick up to 3", options: opts("Nollywood", "Anime", "K-dramas", "Hollywood movies", "Reality TV", "Football", "Sitcoms", "Crime and thrillers", "Documentaries", "YouTube creators"), min_pick: 1, max_pick: 3, weight: "normal" },
  { kind: "this_or_that", title: "Morning person or night owl?", subtitle: "", options: opts("Early bird", "Night owl"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Coffee or tea?", subtitle: "", options: opts("Coffee", "Tea"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Dogs or cats?", subtitle: "", options: opts("Dogs", "Cats"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Keeping in touch", subtitle: "", options: opts("Texting all day", "Long phone calls"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Your free evening", subtitle: "", options: opts("Hitting the gym", "Chilling on the couch"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "this_or_that", title: "Dream holiday", subtitle: "", options: opts("A beach resort", "Exploring a new city"), min_pick: 1, max_pick: 1, weight: "normal" },
  { kind: "scale", title: "How competitive are you?", subtitle: "", options: opts("Just for fun", "I play to win"), min_pick: 1, max_pick: 1, weight: "normal" },
];

export const MAX_QUESTIONS = 25;

// ---------------------------------------------------------------- checking what people send

/** The same inbox written differently counts once: lower case, no +tags, and no dots for Gmail (matches pact_email_key in the database) */
export function emailKey(email: string) {
  const e = email.trim().toLowerCase();
  const [user, domain] = [e.slice(0, e.lastIndexOf("@")), e.slice(e.lastIndexOf("@") + 1)];
  const local = user.split("+")[0];
  return domain === "gmail.com" || domain === "googlemail.com" ? `${local.replace(/\./g, "")}@gmail.com` : `${local}@${domain}`;
}

/** Throwaway inboxes people use to sign up many times */
const THROWAWAY = new Set(["mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "throwawaymail.com", "fakeinbox.com", "emailondeck.com", "moakt.com", "mohmal.com", "tempail.com", "burnermail.io", "inboxkitten.com", "spamgourmet.com", "mailcatch.com", "tmail.ws", "tmpmail.org", "tmpmail.net", "1secmail.com", "1secmail.org", "1secmail.net", "emailfake.com", "fakemail.net", "luxusmail.org", "mail.tm", "mailpoof.com", "dropmail.me", "minuteinbox.com", "tempinbox.com", "discard.email", "spambox.us", "mytemp.email", "33mail.com", "harakirimail.com", "grr.la", "pokemail.net", "spam4.me"]);
export function isThrowaway(email: string) {
  return THROWAWAY.has(email.trim().toLowerCase().split("@")[1] ?? "");
}

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
  // One thing each: matching pairs people for a single reason
  const intents = (Array.isArray(a.intents) ? a.intents : []).filter((i): i is PactIntent => pact.intents.includes(i as PactIntent)).slice(0, 1);
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
  const work = typeof a.work === "string" && WORK.includes(a.work) ? a.work : undefined;
  if (intents.includes("business") && !work) return "Tell us what you do.";
  return { gender, intents, seeking: romantic ? seeking : [], age, ageMin, ageMax, area, work };
}

// ---------------------------------------------------------------- reveal night

/** Your match, once you've revealed them */
export type RevealMatch = {
  alias: string;
  score: number;
  intent: PactIntent;
  age?: number;
  area: string | null;
  work: string | null;
  shared: { q: string; a: string }[];
  differ: { q: string; mine: string; theirs: string } | null;
  sessionId: string | null;
  theyHaveAccount: boolean;
  /** A second match, because the first one didn't join in time */
  rematch?: boolean;
};

/** What reveal night shows someone: nothing yet to reveal, a teaser to tap, or their match */
export type PactView =
  | { kind: "none"; lost: boolean }
  | { kind: "teaser"; score: number; intent: PactIntent; inCommon: number; rematch: boolean }
  | { kind: "match"; match: RevealMatch };

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
 * candidates are found, then the strongest pairs are taken first. Small pacts compare
 * everyone with everyone; big ones only compare each person with the people whose answers
 * are closest to theirs, which keeps 100,000 people to a few seconds.
 */
export function matchEveryone(questions: PactQuestion[], entries: Entry[]): Pair[] {
  return entries.length <= EXACT_UP_TO ? matchExact(questions, entries) : matchLarge(questions, entries);
}

const KEEP = 25;
const EXACT_UP_TO = 3000;

/** Every pair is compared (about 4.5 million comparisons at 3,000 people) */
export function matchExact(questions: PactQuestion[], entries: Entry[]): Pair[] {
  const code = encode(questions, entries);
  const tops = new TopLists(entries.length);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const intent = code.intentOf(i, j);
      if (!intent) continue;
      const s = code.score(i, j, intent);
      if (s >= 0) tops.add(i, j, s);
    }
  }
  return pairUp(questions, entries, tops);
}

/** Only the closest few hundred people are compared with each person */
export function matchLarge(questions: PactQuestion[], entries: Entry[], opts: { rounds?: number; window?: number } = {}): Pair[] {
  const n = entries.length;
  const rounds = opts.rounds ?? 8;
  const window = opts.window ?? 16;
  const code = encode(questions, entries);
  const rand = seeded(n * 7919 + questions.length);

  // Groups of people by what they can be matched for (love and spicy also by their gender)
  const groups = new Map<string, number[]>();
  const join = (k: string, i: number) => (groups.get(k) ?? groups.set(k, []).get(k)!).push(i);
  for (let i = 0; i < n; i++) {
    const a = entries[i].about;
    for (const t of a.intents) join(t === "love" || t === "spicy" ? `${t}:${a.gender}` : t, i);
  }
  const targets = (i: number) => {
    const a = entries[i].about;
    return a.intents.flatMap((t) => (t === "love" || t === "spicy" ? a.seeking.map((g) => `${t}:${g}`) : [t]));
  };

  // Each round sorts everyone along a random mix of their answers; people next to you in
  // that order answered a lot like you. Several rounds catch different kinds of alike.
  const orders: Map<string, { idx: Int32Array; keys: Float64Array }>[] = [];
  const keysByRound: Float64Array[] = [];
  for (let r = 0; r < rounds; r++) {
    const keys = code.project(rand);
    keysByRound.push(keys);
    const m = new Map<string, { idx: Int32Array; keys: Float64Array }>();
    for (const [k, list] of groups) {
      const idx = Int32Array.from(list).sort((x, y) => keys[x] - keys[y]);
      m.set(k, { idx, keys: Float64Array.from(idx, (x) => keys[x]) });
    }
    orders.push(m);
  }

  const tops = new TopLists(n);
  const seen = new Int32Array(n).fill(-1);
  const consider = (i: number, j: number) => {
    if (j === i || seen[j] === i) return;
    seen[j] = i;
    const intent = code.intentOf(i, j);
    if (!intent) return;
    const s = code.score(i, j, intent);
    if (s >= 0) tops.add(i, j, s);
  };
  for (let i = 0; i < n; i++) {
    for (const k of targets(i)) {
      for (let r = 0; r < rounds; r++) {
        const o = orders[r].get(k);
        if (!o) continue;
        const at = lowerBound(o.keys, keysByRound[r][i]);
        const from = Math.max(0, at - window), to = Math.min(o.idx.length, at + window);
        for (let p = from; p < to; p++) consider(i, o.idx[p]);
      }
      // A few people at random too, so nobody is boxed in
      const g = groups.get(k);
      if (g) for (let x = 0; x < 6; x++) consider(i, g[Math.floor(rand() * g.length)]);
    }
  }
  return pairUp(questions, entries, tops);
}

/** Strongest pairs first; each person is in one pair at most */
function pairUp(questions: PactQuestion[], entries: Entry[], tops: TopLists): Pair[] {
  const edges = tops.edges();
  const taken = new Uint8Array(entries.length);
  const pairs: Pair[] = [];
  for (const [i, j] of edges) {
    if (taken[i] || taken[j]) continue;
    taken[i] = taken[j] = 1;
    const x = entries[i], y = entries[j];
    const intent = matchIntent(x.about, y.about)!;
    const c = compare(questions, x, y, intent)!;
    pairs.push({ a: x.id, b: y.id, score: c.score, intent, shared: c.shared, differ: c.differ });
  }
  return pairs;
}

/** Each person's best candidates so far (25 each, kept in flat number arrays so 100,000 people stay light) */
class TopLists {
  private score: Int16Array;
  private other: Int32Array;
  private count: Uint8Array;
  private low: Int16Array; // the weakest score kept, once full
  constructor(private n: number) {
    this.score = new Int16Array(n * KEEP);
    this.other = new Int32Array(n * KEEP);
    this.count = new Uint8Array(n);
    this.low = new Int16Array(n).fill(-1);
  }
  add(i: number, j: number, score: number) {
    this.push(i, j, score);
    this.push(j, i, score);
  }
  private push(me: number, other: number, score: number) {
    const c = this.count[me];
    if (c === KEEP && score <= this.low[me]) return;
    const base = me * KEEP;
    for (let k = 0; k < c; k++) if (this.other[base + k] === other) return;
    if (c < KEEP) {
      this.score[base + c] = score;
      this.other[base + c] = other;
      this.count[me] = c + 1;
      if (c + 1 < KEEP) return;
    } else {
      // Replace the weakest
      let at = 0;
      for (let k = 1; k < KEEP; k++) if (this.score[base + k] < this.score[base + at]) at = k;
      this.score[base + at] = score;
      this.other[base + at] = other;
    }
    let low = this.score[base];
    for (let k = 1; k < KEEP; k++) if (this.score[base + k] < low) low = this.score[base + k];
    this.low[me] = low;
  }
  /** All kept pairs, best first */
  edges(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let i = 0; i < this.n; i++) {
      const base = i * KEEP;
      for (let k = 0; k < this.count[i]; k++) {
        const o = this.other[base + k];
        // Each pair once: from the lower number's side, or from the higher side if the lower one didn't keep it
        if (o > i || !this.has(o, i)) out.push([Math.min(i, o), Math.max(i, o), this.score[base + k]]);
      }
    }
    return out.sort((p, q) => q[2] - p[2]);
  }
  private has(me: number, other: number) {
    const base = me * KEEP;
    for (let k = 0; k < this.count[me]; k++) if (this.other[base + k] === other) return true;
    return false;
  }
}

/**
 * Everyone's answers as numbers, so comparing two people is quick. The score is worked out
 * exactly as compare() does it (compare() also says what they share, for the final pairs).
 */
function encode(questions: PactQuestion[], entries: Entry[]) {
  const n = entries.length;
  const Q = questions.length;
  const val = new Int32Array(n * Q).fill(-1); // option number, or 1 to 5 on a scale
  const lo = new Uint32Array(n * Q), hi = new Uint32Array(n * Q); // picks for "pick a few", as bits
  const area = new Int32Array(n).fill(-1), work = new Int32Array(n).fill(-1);
  const names = new Map<string, number>();
  const nameId = (s: string | undefined) => (s ? (names.get(s) ?? names.set(s, names.size).get(s)!) : -1);
  const optIndex = questions.map((q) => new Map(q.options.map((o, k) => [o.id, k])));
  for (let i = 0; i < n; i++) {
    const e = entries[i];
    area[i] = nameId(e.about.area);
    work[i] = nameId(e.about.work);
    for (let qi = 0; qi < Q; qi++) {
      const q = questions[qi];
      const v = e.answers[q.id];
      if (v === undefined) continue;
      const at = i * Q + qi;
      if (q.kind === "scale") val[at] = Number(v);
      else if (q.kind === "choose_many") {
        val[at] = 0;
        for (const id of v as string[]) {
          const k = optIndex[qi].get(id);
          if (k === undefined) continue;
          if (k < 32) lo[at] |= 1 << k;
          else hi[at] |= 1 << (k - 32);
        }
      } else {
        const k = optIndex[qi].get(v as string);
        if (k !== undefined) val[at] = k;
      }
    }
  }
  // Who they are and what they want, as numbers, for a quick matchIntent()
  const age = new Int16Array(n), ageMin = new Int16Array(n), ageMax = new Int16Array(n);
  const gender = new Uint8Array(n), seeks = new Uint8Array(n), wantsBits = new Uint8Array(n);
  const G = { woman: 1, man: 2 } as const;
  for (let i = 0; i < n; i++) {
    const a = entries[i].about;
    age[i] = a.age;
    ageMin[i] = a.ageMin;
    ageMax[i] = a.ageMax;
    gender[i] = G[a.gender];
    for (const g of a.seeking) seeks[i] |= G[g];
    PRIORITY.forEach((p, k) => a.intents.includes(p) && (wantsBits[i] |= 1 << k));
  }
  /** Same answer as matchIntent(), from the numbers */
  function intentOf(i: number, j: number): PactIntent | null {
    if (age[i] < ageMin[j] || age[i] > ageMax[j] || age[j] < ageMin[i] || age[j] > ageMax[i]) return null;
    const both = wantsBits[i] & wantsBits[j];
    if (!both) return null;
    const mutual = (seeks[i] & gender[j]) !== 0 && (seeks[j] & gender[i]) !== 0;
    for (let k = 0; k < 4; k++) {
      if (!(both & (1 << k))) continue;
      if (k < 2 && !mutual) continue; // love and spicy need both to want each other
      return PRIORITY[k];
    }
    return null;
  }

  const kind = questions.map((q) => q.kind);
  const w = questions.map((q) => WEIGHT_VALUE[q.weight]);
  const breaker = questions.map((q) => q.weight === "dealbreaker");

  /** 0 to 100, or -1 if a deal-breaker rules them out */
  function score(i: number, j: number, intent: PactIntent) {
    const romantic = intent === "love" || intent === "spicy";
    let got = 0, max = 0;
    const bi = i * Q, bj = j * Q;
    for (let qi = 0; qi < Q; qi++) {
      const x = val[bi + qi], y = val[bj + qi];
      if (x < 0 || y < 0) continue;
      max += w[qi];
      const k = kind[qi];
      if (k === "scale") got += w[qi] * (1 - Math.abs(x - y) / 4);
      else if (k === "choose_many") {
        const both = bits(lo[bi + qi] & lo[bj + qi]) + bits(hi[bi + qi] & hi[bj + qi]);
        const union = bits(lo[bi + qi] | lo[bj + qi]) + bits(hi[bi + qi] | hi[bj + qi]) || 1;
        got += w[qi] * Math.min(1, (both / union) * 1.6);
      } else if (x === y) got += w[qi];
      else if (breaker[qi] && romantic) return -1;
    }
    let bonus = 0;
    if (area[i] >= 0 && area[i] === area[j]) bonus += 0.04;
    if (intent === "business" && work[i] >= 0 && work[i] === work[j]) bonus += 0.03;
    return Math.round(Math.min(1, (max ? got / max : 0.5) + bonus) * 100);
  }

  /** A random mix of everyone's answers (one number each), for sorting people who answered alike next to each other */
  function project(rand: () => number) {
    const weights = questions.map((q) => Float64Array.from({ length: Math.max(q.options.length, 2) }, () => (rand() * 2 - 1) * WEIGHT_VALUE[q.weight]));
    const keys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let qi = 0; qi < Q; qi++) {
        const at = i * Q + qi;
        const x = val[at];
        if (x < 0) continue;
        const wt = weights[qi];
        if (kind[qi] === "scale") s += wt[0] * (x - 3);
        else if (kind[qi] === "choose_many") {
          for (let k = 0; k < wt.length; k++) if (k < 32 ? lo[at] & (1 << k) : hi[at] & (1 << (k - 32))) s += wt[k] / 2;
        } else s += wt[x] ?? 0;
      }
      keys[i] = s;
    }
    return keys;
  }
  return { score, project, intentOf };
}

function bits(v: number) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function lowerBound(a: Float64Array, x: number) {
  let l = 0, h = a.length;
  while (l < h) {
    const m = (l + h) >>> 1;
    if (a[m] < x) l = m + 1;
    else h = m;
  }
  return l;
}

/** The same "random" numbers every time for the same pact, so a retried reveal gives the same pairs */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

export type Phase = "open" | "closed" | "matching" | "revealed";
/** "1 person", "2 people", "4,127 people" (and the same for other words) */
export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
export const people = (n: number) => plural(n, "person", "people");

export function pactPhase(p: Pick<Pact, "closes_at" | "reveal_at" | "status">, now = Date.now()): Phase {
  if (p.status === "revealed") return "revealed";
  // Reveal time has come and everyone is being matched (a few minutes for big pacts)
  if (now >= new Date(p.reveal_at).getTime()) return "matching";
  if (now >= new Date(p.closes_at).getTime()) return "closed";
  return "open";
}

/** "Fri 30 Oct, 7:00 pm" in Lagos time, written the same on the server and the phone */
export function pactDate(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toLowerCase()}`;
}
