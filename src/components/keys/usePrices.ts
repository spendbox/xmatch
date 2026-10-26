"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GIFTS, REOPEN_COST, type Gift } from "@/lib/keys";

export type Prices = {
  reopen_cost: number;
  reveal_cost: number;
  free_reveals: number;
  /** Game switches (1 = on) */
  game_truths: number;
  game_tot: number;
  game_c4: number;
  game_words: number;
  game_whot: number;
  game_checkers: number;
  game_chess: number;
  game_ayo: number;
  game_bomb: number;
  game_gems: number;
  game_ludo: number;
  game_snakes: number;
  /** Play a stranger: Keys per match */
  play_cost: number;
  /** Ghost mode, for 30 days */
  ghost_cost: number;
  /** Masquerade: minutes between new pairs, and how long a pair chat lasts */
  pair_gap_minutes: number;
  pair_minutes: number;
};
const DEFAULTS: Prices = { reopen_cost: REOPEN_COST, reveal_cost: 1, free_reveals: 10, game_truths: 1, game_tot: 1, game_c4: 1, game_words: 1, game_whot: 1, game_checkers: 1, game_chess: 1, game_ayo: 1, game_bomb: 1, game_gems: 1, game_ludo: 1, game_snakes: 1, play_cost: 1, ghost_cost: 100, pair_gap_minutes: 60, pair_minutes: 60 };

// Prices are set by the admin in the database. Loaded once per visit and shared.
let pricesCache: Promise<Prices> | null = null;
let giftsCache: Promise<Gift[]> | null = null;

function loadPrices() {
  pricesCache ??= Promise.resolve(createClient().from("app_settings").select("key, value")).then(({ data }) => {
    const p = { ...DEFAULTS };
    for (const r of data ?? []) if (r.key in p) (p as Record<string, number>)[r.key as string] = r.value as number;
    return p;
  });
  return pricesCache;
}

function loadGifts() {
  giftsCache ??= Promise.resolve(createClient().from("gifts").select("id, name, emoji, price, sort, retired").order("sort")).then(({ data }) =>
    data?.length ? (data as (Gift & { sort: number })[]).map(({ id, name, emoji, price, retired }) => ({ id, name, emoji, price, retired })) : GIFTS,
  );
  return giftsCache;
}

/** Current prices (reopening a past pair, photo reveals). */
export function usePrices() {
  const [p, setP] = useState<Prices>(DEFAULTS);
  useEffect(() => {
    loadPrices().then(setP).catch(() => {});
  }, []);
  return p;
}

/** Gifts with their current prices. */
export function useGifts() {
  const [g, setG] = useState<Gift[]>(GIFTS);
  useEffect(() => {
    loadGifts().then(setG).catch(() => {});
  }, []);
  return g;
}
