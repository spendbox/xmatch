"use client";

import { setThingPrompts, type ThingPromptRow } from "@/lib/things";

/** Hands the "Things about you" cards Admin set up to the app, before anything shows them */
export function ThingPromptsSync({ rows }: { rows: ThingPromptRow[] | null }) {
  setThingPrompts(rows);
  return null;
}
