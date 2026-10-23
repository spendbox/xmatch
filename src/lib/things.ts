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
};

export const NEEDED = 10;
export const MAX_THINGS = 40;
export const MAX_ANSWER = 60;

const T = {
  violet: "linear-gradient(150deg, #6d4ff0 0%, #3a2896 100%)",
  rose: "linear-gradient(150deg, #e0477e 0%, #8a1d4a 100%)",
  gold: "linear-gradient(150deg, #f2a93d 0%, #b56a0c 100%)",
  mint: "linear-gradient(150deg, #1fae7a 0%, #0c5c42 100%)",
  sky: "linear-gradient(150deg, #3b8cf0 0%, #1a4a9a 100%)",
  ember: "linear-gradient(150deg, #ef6a3a 0%, #8f2a10 100%)",
};

export const PROMPTS: ThingPrompt[] = [
  { id: "food", text: "My comfort food is…", ideas: ["Jollof rice", "Suya", "Amala and ewedu", "Pounded yam and egusi", "Shawarma", "Pizza"], tone: T.ember },
  { id: "weekend", text: "My perfect weekend…", ideas: ["Owambe till late", "Beach day", "Netflix and chill", "Church, then brunch", "Out with the squad", "Sleeping in"], tone: T.violet },
  { id: "music", text: "On repeat right now…", ideas: ["Burna Boy", "Wizkid", "Asake", "Tems", "Rema", "Amapiano"], tone: T.rose },
  { id: "team", text: "My football team…", ideas: ["Arsenal", "Chelsea", "Man United", "Man City", "Liverpool", "Super Eagles"], tone: T.mint },
  { id: "work", text: "What I do…", ideas: ["Tech", "Banking", "Medicine", "Law", "Fashion", "Still a student"], tone: T.sky },
  { id: "spot", text: "You'll usually find me…", ideas: ["At the gym", "In the kitchen", "At church", "Gaming", "With a book", "At a lounge"], tone: T.gold },
  { id: "trip", text: "My dream trip…", ideas: ["Zanzibar", "Dubai", "Paris", "Cape Town", "Bali", "Obudu"], tone: T.sky },
  { id: "drink", text: "My go-to drink…", ideas: ["Chapman", "Zobo", "Palm wine", "Coffee", "Malt", "Water, honestly"], tone: T.rose },
  { id: "love", text: "My love language…", ideas: ["Quality time", "Words of affirmation", "Gifts", "Acts of service", "Physical touch"], tone: T.rose },
  { id: "green", text: "A green flag for me…", ideas: ["Good listener", "Makes me laugh", "Ambitious", "Kind to waiters", "Texts back"], tone: T.mint },
  { id: "red", text: "An instant red flag…", ideas: ["Rude to waiters", "Always late", "No ambition", "Bad hygiene", "Never texts back"], tone: T.ember },
  { id: "skill", text: "I'm secretly good at…", ideas: ["Cooking", "Dancing", "Singing", "Drawing", "Fixing things", "Making people laugh"], tone: T.gold },
  { id: "show", text: "Best show ever…", ideas: ["Game of Thrones", "Money Heist", "Squid Game", "Big Brother Naija", "Anime", "The Office"], tone: T.violet },
  { id: "game", text: "My favourite game…", ideas: ["FIFA", "Ludo", "Whot", "Chess", "Call of Duty", "Scrabble"], tone: T.mint },
  { id: "lang", text: "Languages I speak…", ideas: ["English", "Yoruba", "Igbo", "Hausa", "Pidgin", "French"], tone: T.sky },
  { id: "clock", text: "I'm more of a…", ideas: ["Morning person", "Night owl", "Afternoon napper"], tone: T.gold },
  { id: "pet", text: "My pet peeve…", ideas: ["Loud chewing", "Lateness", "Dry replies", "Traffic", "Noise"], tone: T.ember },
  { id: "dream", text: "Someday I want to…", ideas: ["Start a business", "Travel the world", "Write a book", "Buy a house", "Retire early"], tone: T.violet },
  { id: "kid", text: "Growing up I wanted to be…", ideas: ["A doctor", "A pilot", "A footballer", "A musician", "A lawyer"], tone: T.sky },
  { id: "need", text: "I can't live without…", ideas: ["Music", "My phone", "Pepper", "My family", "Coffee"], tone: T.gold },
  { id: "take", text: "My hot take…", ideas: ["Fried rice beats jollof", "Pineapple belongs on pizza", "Calls beat texts", "Breakfast is overrated"], tone: T.ember },
  { id: "place", text: "My favourite spot in town…", ideas: ["Lekki Conservation Centre", "Nike Art Gallery", "The beach", "A quiet cafe"], tone: T.mint },
  { id: "fact", text: "A fun fact about me…", ideas: [], tone: T.violet },
  { id: "else", text: "Something else about me…", ideas: [], tone: T.rose },
];

/** Prompts you can answer more than once */
export const REPEATABLE = new Set(["else", "fact"]);

export const promptOf = (id: string) => PROMPTS.find((p) => p.id === id) ?? PROMPTS[PROMPTS.length - 1];

/** The next prompt to show: one you haven't answered yet, in a shuffled but steady order */
export function nextPrompt(things: Thing[], skip: string[] = []): ThingPrompt {
  const used = new Set(things.map((t) => t.p).filter((p) => !REPEATABLE.has(p)));
  const open = PROMPTS.filter((p) => !used.has(p.id) && !skip.includes(p.id));
  return open[0] ?? promptOf("else");
}
