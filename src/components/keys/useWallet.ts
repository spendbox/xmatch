"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Wallet } from "@/lib/keys";

/** Your Keys balance and free masquerades left, kept up to date live. */
export function useWallet(userId: string | null, initial?: Wallet | null) {
  const [wallet, setWallet] = useState<Wallet | null>(initial ?? null);

  const refresh = useCallback(async () => {
    const { data } = await createClient().rpc("my_wallet");
    if (data) setWallet(data as Wallet);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!initial) refresh();
    const supabase = createClient();
    const ch = supabase
      .channel(`wallet-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, initial, refresh]);

  return { wallet, refresh };
}
