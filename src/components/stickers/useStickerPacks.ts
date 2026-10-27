"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { keysError } from "@/components/keys/GiftSheet";
import type { StickerPack } from "@/lib/stickers";

// The packs you own, loaded once per visit and shared by every chat
let ownedNow: string[] | null = null;
let loading: Promise<string[]> | null = null;
const listeners = new Set<(o: string[]) => void>();

function load() {
  loading ??= Promise.resolve(createClient().rpc("my_sticker_packs")).then(({ data, error }) => {
    if (error) loading = null; // try again next time (e.g. before update 93 runs)
    ownedNow = Array.isArray(data) ? (data as string[]) : (ownedNow ?? []);
    return ownedNow;
  });
  return loading;
}

/** Sticker packs you own, and buying one with Keys */
export function useStickerPacks(fetchNow = true) {
  const [owned, setOwned] = useState<string[]>(() => ownedNow ?? []);
  useEffect(() => {
    listeners.add(setOwned);
    return () => {
      listeners.delete(setOwned);
    };
  }, []);
  useEffect(() => {
    if (fetchNow) void load().then(setOwned);
  }, [fetchNow]);
  const buy = useCallback(async (p: StickerPack): Promise<string | null> => {
    const { error } = await createClient().rpc("buy_sticker_pack", { p_pack: p.id });
    if (error) return error.message.includes("buy_sticker_pack") ? "Sticker packs are coming soon." : keysError(error.message);
    ownedNow = [...new Set([...(ownedNow ?? []), p.id])];
    listeners.forEach((f) => f(ownedNow!));
    return null;
  }, []);
  return { owned, buy };
}
