/**
 * "Ask them about…" hints for a chat: built for each pair from what they have in common,
 * where they disagree, what the other person is into, where they are and the time of day.
 * Only uses what the other person already shows in that chat.
 */

export type HintData = {
  connected: boolean;
  interests: string[];
  place: string | null;
  tot: { same: number; rounds: number; items: { q: string; a: string }[]; differ?: { q: string; mine: string; theirs: string }[] };
  words: string[] | null;
  linkups: { count: number; items: { pact: string; q: string; a: string }[] } | null;
};

export type Hint = { id: string; label: string; text: string; weight: number };

// An easy opener for each interest (shared or theirs)
const OPENERS: Record<string, string[]> = {
  Music: ["Who's the best Afrobeats artist right now?", "What song have you had on repeat this week?"],
  Travel: ["Where's the next trip?", "Best place you've ever been to?"],
  Food: ["What's the best thing you've eaten this week?", "Which Nigerian food would you defend with your life?"],
  Fitness: ["Gym in the morning or the evening?", "What's your workout this week?"],
  Movies: ["Best movie you've seen this year?", "Nollywood or Hollywood tonight?"],
  Books: ["What are you reading right now?", "One book everyone should read?"],
  Gaming: ["What are you playing right now?", "EA FC, COD or Whot: which one are you unbeatable at?"],
  Art: ["What kind of art do you make or love?", "Who's an artist everyone should know?"],
  Fashion: ["What's your signature look?", "Best thing in your wardrobe right now?"],
  Tech: ["What are you building or using right now?", "Best app nobody knows about?"],
  Nature: ["Beach or mountains?", "Best outdoor spot near you?"],
  Dancing: ["What's your go-to dance move?", "Which song gets you on the dance floor every time?"],
  Photography: ["What do you love taking pictures of?", "Phone or camera?"],
  Cooking: ["What's your best dish?", "What should I learn to cook first?"],
  Sports: ["Arsenal or Chelsea? Choose wisely.", "Who are you supporting this season?"],
  Faith: ["What does a good Sunday look like for you?", "What keeps you grounded?"],
  Comedy: ["Who's the funniest comedian right now?", "Last thing that made you laugh out loud?"],
  Pets: ["Dog person or cat person?", "Tell me about your pet!"],
  Business: ["What are you building?", "Best business idea you've ever had?"],
  Nightlife: ["Best spot for a night out?", "Owambe or club?"],
  Poetry: ["Who's your favourite poet?", "Do you write too?"],
  Anime: ["What anime should I start with?", "Top 3 anime, go."],
};

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];

function timeHint(now: Date): Hint {
  const day = now.getDay(); // 0 Sunday
  const h = now.getHours();
  if ((day === 5 || day === 6) && h >= 17) return { id: "time", label: "It's the weekend", text: "What's the plan tonight?", weight: 2 };
  if (h >= 23 || h < 4) return { id: "time", label: "It's late", text: "Why are we both awake right now? 😅", weight: 2 };
  if (day === 1 && h < 12) return { id: "time", label: "It's Monday morning", text: "How's your Monday going?", weight: 2 };
  if (h >= 12 && h < 14) return { id: "time", label: "It's lunchtime", text: "What's for lunch?", weight: 2 };
  if (day === 0) return { id: "time", label: "It's Sunday", text: "How are you spending your Sunday?", weight: 1 };
  return { id: "time", label: "Right now", text: "How's your day going so far?", weight: 1 };
}

/** Every hint we could show for this pair, best first */
export function buildHints(d: HintData | null, theirInterests: string[], now = new Date(), seed = 0): Hint[] {
  const out: Hint[] = [];
  const shared = d?.interests ?? [];
  for (const [k, x] of shared.entries()) {
    const ideas = OPENERS[x] ?? [`What got you into ${x.toLowerCase()}?`];
    out.push({ id: `s-${x}`, label: `You both like ${x}`, text: pick(ideas, seed + k), weight: 10 - k });
  }
  for (const [k, x] of (d?.tot.differ ?? []).entries()) {
    out.push({ id: `d-${x.q}`, label: `They picked ${x.theirs}, you picked ${x.mine}`, text: `${x.theirs} over ${x.mine}? Explain yourself 😂`, weight: 9 - k });
  }
  if (d?.connected) {
    for (const [k, x] of (d.linkups?.items ?? []).entries()) {
      out.push({ id: `l-${x.q}`, label: `You both said "${x.a}"`, text: `We both said "${x.a}" for ${x.q.toLowerCase()} in ${x.pact}. Why did you pick it?`, weight: 8 - k });
    }
    for (const [k, w] of (d.words ?? []).slice(0, 3).entries()) {
      out.push({ id: `w-${w}`, label: `You both mentioned ${w}`, text: `You mentioned ${w} too! Tell me more.`, weight: 7 - k });
    }
  }
  const theirsOnly = theirInterests.filter((x) => !shared.includes(x));
  for (const [k, x] of theirsOnly.slice(0, 3).entries()) {
    const ideas = OPENERS[x] ?? [`How did you get into ${x.toLowerCase()}?`];
    out.push({ id: `t-${x}`, label: `They're into ${x}`, text: pick(ideas, seed + k + 1), weight: 6 - k });
  }
  if (d?.place) {
    const where = d.place === "same country" ? null : d.place;
    out.push({ id: "p", label: where ? `You're both in ${where}` : "You're in the same country", text: where ? `Best spot to eat in ${where}?` : "Which part are you in?", weight: 4 });
  }
  out.push(timeHint(now));
  return out.sort((a, b) => b.weight - a.weight);
}

/** Three hints to show; "more" moves through the rest */
export function hintPage(all: Hint[], page: number, size = 3): Hint[] {
  if (all.length <= size) return all;
  const start = (page * size) % all.length;
  return [...all, ...all].slice(start, start + size);
}
