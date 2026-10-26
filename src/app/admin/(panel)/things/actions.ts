"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { TONES } from "@/lib/things";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const cleanIdeas = (ideas: string[]) =>
  [...new Set(ideas.map((i) => clean(i).slice(0, 60)).filter(Boolean))].slice(0, 12);

export async function saveThingPrompt(input: {
  id?: string;
  text: string;
  ideas: string[];
  tone: string;
  repeatable: boolean;
  active: boolean;
}): Promise<{ error?: string }> {
  await requireAdmin();
  let text = clean(input.text);
  if (text.length < 2 || text.length > 80) return { error: "The question should be 2 to 80 characters." };
  // Cards read as the start of a sentence: "My comfort food is…"
  if (!/[…?:]$/.test(text)) text = text.replace(/\.+$/, "") + "…";
  const row = {
    text,
    ideas: cleanIdeas(input.ideas),
    tone: input.tone in TONES ? input.tone : "violet",
    repeatable: !!input.repeatable,
    active: !!input.active,
    updated_at: new Date().toISOString(),
  };
  const db = createAdminClient();
  if (input.id) {
    const { error } = await db.from("thing_prompts").update(row).eq("id", input.id);
    if (error) return { error: "Couldn't save. Please try again." };
  } else {
    const { data: last } = await db.from("thing_prompts").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const id = `q${Date.now().toString(36)}`;
    const { error } = await db.from("thing_prompts").insert({ ...row, id, sort: ((last?.sort as number | undefined) ?? 0) + 10 });
    if (error) return { error: "Couldn't add it. Please try again." };
  }
  revalidatePath("/admin/things");
  return {};
}

/** Move a card up or down the list (people see them in this order) */
export async function moveThingPrompt(id: string, dir: -1 | 1): Promise<{ error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.from("thing_prompts").select("id, sort").order("sort").order("id");
  const list = (data ?? []) as { id: string; sort: number }[];
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {};
  [list[i], list[j]] = [list[j], list[i]];
  // Renumber so the order is always clean
  const changed = list.map((r, k) => ({ id: r.id, sort: (k + 1) * 10, was: r.sort })).filter((r) => r.sort !== r.was);
  for (const r of changed) {
    const { error } = await db.from("thing_prompts").update({ sort: r.sort }).eq("id", r.id);
    if (error) return { error: "Couldn't move it. Please try again." };
  }
  revalidatePath("/admin/things");
  return {};
}
