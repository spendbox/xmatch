/**
 * "Things about you": cards like "My comfort food is… Jollof rice". Each answer is
 * short. The database pulls the key words out when you save (jollof, rice), and
 * matching counts the words two people share.
 */
export type Thing = { p: string; a: string };

export type ThingPrompt = {
  id: string;
  /** Shown on the card, finished by the answer */
  text: string;
  /** Tap to fill */
  ideas: string[];
  /** Card colour */
  tone: string;
  /** Can be answered more than once */
  repeatable?: boolean;
  /** Hidden by Admin: not offered any more (answers already given still show) */
  active?: boolean;
};

/** A card as Admin keeps it (thing_prompts) */
export type ThingPromptRow = { id: string; text: string; ideas: string[]; tone: string; sort: number; repeatable: boolean; active: boolean };

export const NEEDED = 10;
export const MAX_THINGS = 40;
export const MAX_ANSWER = 60;

/** Card colours Admin can pick from */
export const TONES = {
  violet: "linear-gradient(150deg, #6d4ff0 0%, #3a2896 100%)",
  rose: "linear-gradient(150deg, #e0477e 0%, #8a1d4a 100%)",
  gold: "linear-gradient(150deg, #f2a93d 0%, #b56a0c 100%)",
  mint: "linear-gradient(150deg, #1fae7a 0%, #0c5c42 100%)",
  sky: "linear-gradient(150deg, #3b8cf0 0%, #1a4a9a 100%)",
  ember: "linear-gradient(150deg, #ef6a3a 0%, #8f2a10 100%)",
};

export const PROMPTS: ThingPrompt[] = [
  { id: "food", text: "My comfort food is…", ideas: ["Jollof rice", "Suya", "Amala and ewedu", "Pounded yam and egusi", "Shawarma", "Pizza"], tone: TONES.ember },
  { id: "weekend", text: "My perfect weekend…", ideas: ["Owambe till late", "Beach day", "Netflix and chill", "Church, then brunch", "Out with the squad", "Sleeping in"], tone: TONES.violet },
  { id: "music", text: "On repeat right now…", ideas: ["Burna Boy", "Wizkid", "Asake", "Tems", "Rema", "Amapiano"], tone: TONES.rose },
  { id: "team", text: "My football team…", ideas: ["Arsenal", "Chelsea", "Man United", "Man City", "Liverpool", "Super Eagles"], tone: TONES.mint },
  { id: "work", text: "What I do…", ideas: ["Tech", "Banking", "Medicine", "Law", "Fashion", "Still a student"], tone: TONES.sky },
  { id: "spot", text: "You'll usually find me…", ideas: ["At the gym", "In the kitchen", "At church", "Gaming", "With a book", "At a lounge"], tone: TONES.gold },
  { id: "trip", text: "My dream trip…", ideas: ["Zanzibar", "Dubai", "Paris", "Cape Town", "Bali", "Obudu"], tone: TONES.sky },
  { id: "drink", text: "My go-to drink…", ideas: ["Chapman", "Zobo", "Palm wine", "Coffee", "Malt", "Water, honestly"], tone: TONES.rose },
  { id: "love", text: "My love language…", ideas: ["Quality time", "Words of affirmation", "Gifts", "Acts of service", "Physical touch"], tone: TONES.rose },
  { id: "green", text: "A green flag for me…", ideas: ["Good listener", "Makes me laugh", "Ambitious", "Kind to waiters", "Texts back"], tone: TONES.mint },
  { id: "red", text: "An instant red flag…", ideas: ["Rude to waiters", "Always late", "No ambition", "Bad hygiene", "Never texts back"], tone: TONES.ember },
  { id: "skill", text: "I'm secretly good at…", ideas: ["Cooking", "Dancing", "Singing", "Drawing", "Fixing things", "Making people laugh"], tone: TONES.gold },
  { id: "show", text: "Best show ever…", ideas: ["Game of Thrones", "Money Heist", "Squid Game", "Big Brother Naija", "Anime", "The Office"], tone: TONES.violet },
  { id: "game", text: "My favourite game…", ideas: ["FIFA", "Ludo", "Whot", "Chess", "Call of Duty", "Scrabble"], tone: TONES.mint },
  { id: "lang", text: "Languages I speak…", ideas: ["English", "Yoruba", "Igbo", "Hausa", "Pidgin", "French"], tone: TONES.sky },
  { id: "clock", text: "I'm more of a…", ideas: ["Morning person", "Night owl", "Afternoon napper"], tone: TONES.gold },
  { id: "pet", text: "My pet peeve…", ideas: ["Loud chewing", "Lateness", "Dry replies", "Traffic", "Noise"], tone: TONES.ember },
  { id: "dream", text: "Someday I want to…", ideas: ["Start a business", "Travel the world", "Write a book", "Buy a house", "Retire early"], tone: TONES.violet },
  { id: "kid", text: "Growing up I wanted to be…", ideas: ["A doctor", "A pilot", "A footballer", "A musician", "A lawyer"], tone: TONES.sky },
  { id: "need", text: "I can't live without…", ideas: ["Music", "My phone", "Pepper", "My family", "Coffee"], tone: TONES.gold },
  { id: "take", text: "My hot take…", ideas: ["Fried rice beats jollof", "Pineapple belongs on pizza", "Calls beat texts", "Breakfast is overrated"], tone: TONES.ember },
  { id: "place", text: "My favourite spot in town…", ideas: ["Lekki Conservation Centre", "Nike Art Gallery", "The beach", "A quiet cafe"], tone: TONES.mint },
  { id: "fact", text: "A fun fact about me…", ideas: [], tone: TONES.violet },
  { id: "else", text: "Something else about me…", ideas: [], tone: TONES.rose },
];

// Until the cards from the database arrive (and if they can't load), the built-in ones are used
const BUILT_IN = PROMPTS.map((p) => ({ ...p, repeatable: p.id === "else" || p.id === "fact", active: true }));
let current: ThingPrompt[] = BUILT_IN;

export const toneOf = (name: string) => TONES[name as keyof typeof TONES] ?? (name.startsWith("linear-gradient") ? name : TONES.violet);

/** Use the cards Admin has set up (called once when the app loads) */
export function setThingPrompts(rows: ThingPromptRow[] | null | undefined) {
  if (!rows?.length) return;
  current = [...rows]
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({ id: r.id, text: r.text, ideas: r.ideas ?? [], tone: toneOf(r.tone), repeatable: r.repeatable, active: r.active }));
}

const fallback = (): ThingPrompt => current.find((p) => p.id === "else") ?? BUILT_IN[BUILT_IN.length - 1];

export const promptOf = (id: string) => current.find((p) => p.id === id) ?? BUILT_IN.find((p) => p.id === id) ?? fallback();

/** The next prompt to show: one you haven't answered yet, in the order Admin set */
export function nextPrompt(things: Thing[], skip: string[] = []): ThingPrompt {
  const repeat = new Set(current.filter((p) => p.repeatable).map((p) => p.id));
  const used = new Set(things.map((t) => t.p).filter((p) => !repeat.has(p)));
  const open = current.filter((p) => p.active !== false && !used.has(p.id) && !skip.includes(p.id));
  return open[0] ?? current.find((p) => p.active !== false && p.repeatable) ?? fallback();
}

// Prompts that run straight into the answer ("I'm secretly good at" + "cooking")
const FLOWS = /\b(is|to|be|find me|a|an|of|at|in|without|about)$/i;

/** One of your things as a sentence, e.g. for Two Truths: "My comfort food is jollof rice" */
export function thingSentence(t: Thing) {
  const lead = promptOf(t.p).text.replace(/…$/, "").trim();
  const a = t.a.trim();
  if (promptOf(t.p).repeatable) return a;
  if (FLOWS.test(lead)) return `${lead} ${a.charAt(0).toLowerCase()}${a.slice(1)}`;
  return `${lead}: ${a}`;
}
