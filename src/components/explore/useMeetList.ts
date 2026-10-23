"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExploreList } from "@/lib/explore";

/**
 * Your top 50 on the Meet page, shared by Home and Meet. The phone keeps the list
 * for 10 minutes, so moving between pages doesn't ask Dashpad again.
 */
const KEEP_MS = 10 * 60_000;
const cacheKey = (uid: string) => `dp_meet_${uid}`;

function readCache(uid?: string): ExploreList | null {
  if (!uid) return null;
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(uid)) ?? "null") as { at: number; data: ExploreList } | null;
    return c && Date.now() - c.at < KEEP_MS ? c.data : null;
  } catch {
    return null;
  }
}

function writeCache(uid: string | undefined, data: ExploreList) {
  if (!uid) return;
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* private mode */
  }
}

/** `initial` skips loading (design previews) */
export function useMeetList(userId: string | undefined, initial: ExploreList | null = null) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<ExploreList | null>(initial);

  const reload = useCallback(async () => {
    const { data } = await supabase.rpc("explore_people", { p_limit: 50 });
    if (data) {
      setList(data as ExploreList);
      writeCache(userId, data as ExploreList);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (initial) return;
    const kept = readCache(userId);
    if (kept) setList(kept);
    else void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { list, reload };
}
