// Prices and packs for Keys, Dashpad's in-app currency.
// Gift prices are also stored in the database, which is what actually charges.

export const FREE_MASQUERADES_PER_DAY = 5;
export const EXTRA_MASQUERADE_COST = 5;
export const EXTEND_COST = 10;
export const EXTEND_MINUTES = 2;
/** Keys to reopen a past masked pair (also set in the database) */
export const REOPEN_COST = 10;

export type KeyPack = { id: string; keys: number; naira: number; tag?: string };

export const KEY_PACKS: KeyPack[] = [
  { id: "p50", keys: 50, naira: 750 },
  { id: "p150", keys: 150, naira: 2000, tag: "Popular" },
  { id: "p500", keys: 500, naira: 4500, tag: "Best value" },
];

export type Gift = { id: string; name: string; emoji: string; price: number; retired?: boolean };

// Fun, friendly gifts first. Retired ones still show in old chats but can't be sent.
export const GIFTS: Gift[] = [
  { id: "thumbsup", name: "Thumbs up", emoji: "👍", price: 1 },
  { id: "fire", name: "Fire", emoji: "🔥", price: 5 },
  { id: "rose", name: "Rose", emoji: "🌹", price: 5 },
  { id: "clap", name: "Respect", emoji: "👏", price: 10 },
  { id: "coffee", name: "Coffee", emoji: "☕", price: 10 },
  { id: "jollof", name: "Jollof", emoji: "🍛", price: 15 },
  { id: "cocktail", name: "Drinks on me", emoji: "🍸", price: 20 },
  { id: "mic", name: "Mic drop", emoji: "🎤", price: 30 },
  { id: "trophy", name: "Trophy", emoji: "🏆", price: 40 },
  { id: "crown", name: "Crown", emoji: "👑", price: 60 },
  { id: "diamond", name: "Diamond", emoji: "💎", price: 100 },
  // Game gifts
  { id: "gg", name: "GG", emoji: "🎮", price: 3 },
  { id: "dice", name: "Lucky dice", emoji: "🎲", price: 5 },
  { id: "clover", name: "Lucky charm", emoji: "🍀", price: 8 },
  { id: "medal", name: "Gold medal", emoji: "🥇", price: 20 },
  { id: "rocket", name: "Rocket", emoji: "🚀", price: 25 },
  { id: "goat", name: "GOAT", emoji: "🐐", price: 50 },
  { id: "chocolate", name: "Chocolate", emoji: "🍫", price: 15, retired: true },
  { id: "teddy", name: "Teddy bear", emoji: "🧸", price: 30, retired: true },
  { id: "bouquet", name: "Bouquet", emoji: "💐", price: 40, retired: true },
];

/** The gifts people can send now */
export const SENDABLE_GIFTS = GIFTS.filter((g) => !g.retired);

export const giftById = (id: string) => GIFTS.find((g) => g.id === id);

export function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

export type Wallet = { balance: number; passes: number; free_left: number; next_free_at: string | null };

/** What each line in a Keys history means (the Keys page and Admin) */
export const KEY_REASONS: Record<string, string> = {
  purchase: "Bought Keys",
  gift: "Sent a gift",
  icebreaker: "Broke the ice",
  icebreaker_refund: "Icebreaker not answered (Keys back)",
  feed_gift: "Sent a gift on the Feed",
  gift_received: "Received a gift",
  extend: "Added 2 minutes",
  extra_masquerade: "Extra masquerade",
  reopen: "Reopened a past pair",
  reveal: "Revealed a photo",
  feed_chat: "Started a chat",
  refund: "Refund",
  event: "Masquerade Night entry",
  meet: "Posted a meet",
  photos: "Unlocked someone's photos",
  explore_message: "Messaged someone from Meet",
  explore_refund: "Keys back: no reply in 48 hours",
  ghost: "Ghost mode (30 days)",
  wave: "Waved at someone",
  setup: "Getting set up",
  signup: "Welcome gift for joining",
  invite: "Invited a friend",
  slow_reveal: "Saw a slow reveal early",
  play: "Played a stranger",
  play_message: "Messaged a player",
  sticker_pack: "Bought a sticker pack",
  scribble: "Sent a scribble",
  draw_together: "Started a drawing together",
  draw_refund: "Keys back: drawing not sent",
  admin: "Admin change",
};
