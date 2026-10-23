"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

const KINDS = ["truths", "tot", "c4", "words", "whot", "checkers", "chess", "ayo", "bomb", "gems"];

export async function setGameOn(kind: string, on: boolean) {
  await requireAdmin();
  if (!KINDS.includes(kind)) return { error: "Unknown game" };
  const { error } = await createAdminClient().from("app_settings").upsert({ key: `game_${kind}`, value: on ? 1 : 0, updated_at: new Date().toISOString() });
  revalidatePath("/admin/games");
  return error ? { error: "Couldn't save." } : {};
}

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** One question per line: "Question | This | That" (spice from the picker) */
export async function addQuestions(text: string, spice: number) {
  await requireAdmin();
  const rows = text
    .split("\n")
    .map((l) => l.split("|").map((p) => clean(p, 60)))
    .filter((p) => p.length === 3 && p.every(Boolean))
    .map(([prompt, a, b]) => ({ prompt, a, b, spice: Math.max(0, Math.min(3, Math.round(spice))) }));
  if (!rows.length) return { error: "Write each one as: Question | This | That" };
  const { error } = await createAdminClient().from("tot_questions").upsert(rows, { onConflict: "a,b", ignoreDuplicates: true });
  revalidatePath("/admin/games");
  return error ? { error: "Couldn't save." } : { added: rows.length };
}

export async function setQuestion(id: number, patch: { active?: boolean; spice?: number }) {
  await requireAdmin();
  const p: Record<string, unknown> = {};
  if (patch.active !== undefined) p.active = !!patch.active;
  if (patch.spice !== undefined) p.spice = Math.max(0, Math.min(3, Math.round(patch.spice)));
  const { error } = await createAdminClient().from("tot_questions").update(p).eq("id", id);
  revalidatePath("/admin/games");
  return error ? { error: "Couldn't save." } : {};
}

export async function addIdeas(text: string) {
  await requireAdmin();
  const rows = text
    .split("\n")
    .map((l) => clean(l, 40))
    .filter(Boolean)
    .map((body) => ({ body }));
  if (!rows.length) return { error: "Write one idea per line." };
  const { error } = await createAdminClient().from("truth_ideas").upsert(rows, { onConflict: "body", ignoreDuplicates: true });
  revalidatePath("/admin/games");
  return error ? { error: "Couldn't save." } : { added: rows.length };
}

export async function setIdea(id: number, active: boolean) {
  await requireAdmin();
  const { error } = await createAdminClient().from("truth_ideas").update({ active }).eq("id", id);
  revalidatePath("/admin/games");
  return error ? { error: "Couldn't save." } : {};
}
