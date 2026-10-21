// Prices and packs for Keys, Dashpad's in-app currency.
// Gift prices are also stored in the database, which is what actually charges.

export const FREE_MASQUERADES_PER_DAY = 5;
export const EXTRA_MASQUERADE_COST = 5;
export const EXTEND_COST = 10;
export const EXTEND_MINUTES = 2;

export type KeyPack = { id: string; keys: number; naira: number; tag?: string };

export const KEY_PACKS: KeyPack[] = [
  { id: "p50", keys: 50, naira: 750 },
  { id: "p150", keys: 150, naira: 2000, tag: "Popular" },
  { id: "p500", keys: 500, naira: 4500, tag: "Best value" },
];

export type Gift = { id: string; name: string; emoji: string; price: number };

export const GIFTS: Gift[] = [
  { id: "rose", name: "Rose", emoji: "🌹", price: 5 },
  { id: "coffee", name: "Coffee date", emoji: "☕", price: 10 },
  { id: "chocolate", name: "Chocolate", emoji: "🍫", price: 15 },
  { id: "cocktail", name: "Cocktail", emoji: "🍸", price: 20 },
  { id: "teddy", name: "Teddy bear", emoji: "🧸", price: 30 },
  { id: "bouquet", name: "Bouquet", emoji: "💐", price: 40 },
  { id: "crown", name: "Crown", emoji: "👑", price: 60 },
  { id: "diamond", name: "Diamond", emoji: "💎", price: 100 },
];

export const giftById = (id: string) => GIFTS.find((g) => g.id === id);

export function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

export type Wallet = { balance: number; passes: number; free_left: number; next_free_at: string | null };
