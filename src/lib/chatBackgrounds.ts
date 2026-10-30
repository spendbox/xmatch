/**
 * Chat backgrounds: pick one in a chat (⋮ → Chat background). Saved on this phone,
 * for that chat or for all your chats.
 */
export type ChatBgId =
  | "classic"
  | "dots"
  | "lilac"
  | "peach"
  | "mint"
  | "ankara"
  | "doodles"
  | "paper"
  | "bubblegum"
  | "midnight"
  | "beach"
  | "sunset"
  | "stars"
  | "aurora"
  | "rain"
  | "snow"
  | "hearts"
  | "fireflies"
  | "ocean"
  | "clouds"
  | "lagos"
  | "bokeh";

export type ChatBg = {
  id: ChatBgId;
  name: string;
  /** Moving scene, or a still background */
  motion: boolean;
  /** Dark backgrounds: the little notes in the chat get a darker look */
  dark?: boolean;
};

export const CHAT_BGS: ChatBg[] = [
  { id: "classic", name: "Classic", motion: false },
  { id: "dots", name: "Dots", motion: false },
  { id: "lilac", name: "Lilac", motion: false },
  { id: "peach", name: "Peach", motion: false },
  { id: "mint", name: "Mint grid", motion: false },
  { id: "ankara", name: "Ankara", motion: false },
  { id: "doodles", name: "Doodles", motion: false },
  { id: "paper", name: "Notebook", motion: false },
  { id: "bubblegum", name: "Bubblegum", motion: false },
  { id: "midnight", name: "Midnight", motion: false, dark: true },
  { id: "beach", name: "Beach", motion: true },
  { id: "sunset", name: "Sunset sea", motion: true, dark: true },
  { id: "stars", name: "Starry night", motion: true, dark: true },
  { id: "aurora", name: "Aurora", motion: true, dark: true },
  { id: "rain", name: "Rainy window", motion: true, dark: true },
  { id: "snow", name: "Snowfall", motion: true },
  { id: "hearts", name: "Floating hearts", motion: true },
  { id: "fireflies", name: "Fireflies", motion: true, dark: true },
  { id: "ocean", name: "Under the sea", motion: true, dark: true },
  { id: "clouds", name: "Clouds", motion: true },
  { id: "lagos", name: "Lagos at night", motion: true, dark: true },
  { id: "bokeh", name: "Bokeh", motion: true, dark: true },
];

const ALL_KEY = "dp_chat_bg";
const ONE_KEY = (chat: string) => `dp_chat_bg_${chat}`;
const valid = (id: string | null | undefined): id is ChatBgId => !!id && CHAT_BGS.some((b) => b.id === id);
export const isChatBg = valid;

/** Your own default for chats nobody has picked a background for */
export function saveMyDefaultBg(id: ChatBgId) {
  try {
    localStorage.setItem(ALL_KEY, id);
  } catch {}
}

/** The background for a chat: its own, else the one for all chats, else the fallback (the chat's mood, or Classic) */
export function loadChatBg(chat: string, fallback: ChatBgId = "classic"): ChatBgId {
  try {
    const one = localStorage.getItem(ONE_KEY(chat));
    if (valid(one)) return one;
    const all = localStorage.getItem(ALL_KEY);
    if (valid(all)) return all;
  } catch {}
  return fallback;
}

export function saveChatBg(chat: string, id: ChatBgId, everywhere: boolean) {
  try {
    if (everywhere) {
      localStorage.setItem(ALL_KEY, id);
      // Every chat follows the new pick
      for (const k of Object.keys(localStorage)) if (k.startsWith(`${ALL_KEY}_`)) localStorage.removeItem(k);
    } else localStorage.setItem(ONE_KEY(chat), id);
  } catch {}
}

export const chatBgInfo = (id: ChatBgId) => CHAT_BGS.find((b) => b.id === id) ?? CHAT_BGS[0];
