"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDrawing, type Drawing } from "@/lib/scribble";

export type SavedScribble = { id: string; drawing: Drawing };

// Your saved scribbles, loaded once per visit and shared by every chat
let savedNow: SavedScribble[] | null = null;
let loading: Promise<SavedScribble[]> | null = null;
const listeners = new Set<(s: SavedScribble[]) => void>();
const tell = () => listeners.forEach((f) => f(savedNow ?? []));

function load(force = false) {
  if (force) loading = null;
  loading ??= Promise.resolve(createClient().from("saved_scribbles").select("id, drawing").order("created_at", { ascending: false }).limit(60)).then(({ data, error }) => {
    if (error) loading = null; // try again next time (e.g. before update 94 runs)
    savedNow = ((data ?? []) as { id: string; drawing: unknown }[]).filter((r) => isDrawing(r.drawing)) as SavedScribble[];
    return savedNow;
  });
  return loading;
}

/** Scribbles you've kept (your own or ones you were sent), free to send again. They're only
    fetched once `load` is true (the scribble tab is open): drawings can be big. */
export function useSavedScribbles(fetchNow = false) {
  const [saved, setSaved] = useState<SavedScribble[]>(() => savedNow ?? []);
  useEffect(() => {
    listeners.add(setSaved);
    return () => {
      listeners.delete(setSaved);
    };
  }, []);
  useEffect(() => {
    if (fetchNow) void load().then(setSaved);
  }, [fetchNow]);

  /** Keep a scribble from a chat. Returns an error to show, or null. */
  const save = useCallback(async (messageId: number, masked: boolean): Promise<string | null> => {
    const { error } = await createClient().rpc("save_scribble", { p_message: messageId, p_masked: masked });
    if (error) return error.message.includes("save_scribble") ? "Saving scribbles is coming soon." : error.message.includes("60 saved") ? error.message : "Couldn't save it. Check your connection.";
    // Fetched again next time the scribble tab opens (not now: nothing's showing them)
    loading = null;
    savedNow = null;
    return null;
  }, []);

  const remove = useCallback(async (id: string) => {
    savedNow = (savedNow ?? []).filter((s) => s.id !== id);
    tell();
    await createClient().rpc("delete_saved_scribble", { p_id: id });
  }, []);

  const refresh = useCallback(() => {
    loading = null;
    savedNow = null;
  }, []);

  return { saved, save, remove, refresh };
}
