"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

export type Icebreaker = { id: number; spice: number; body: string; active: boolean; created_at: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------------- Icebreakers ----------------

export async function addIcebreakers(spice: number, text: string): Promise<{ added: Icebreaker[]; skipped: number; error?: string }> {
  await requireAdmin();
  if (![0, 1, 2, 3].includes(spice)) return { added: [], skipped: 0, error: "Pick a spice level." };
  const lines = [...new Set(text.split("\n").map(clean).filter((l) => l.length >= 5 && l.length <= 300))];
  if (!lines.length) return { added: [], skipped: 0, error: "Write at least one question (one per line)." };
  const db = createAdminClient();
  const { data: existing } = await db.from("icebreakers").select("body").is("event_id", null).in("body", lines);
  const taken = new Set((existing ?? []).map((r) => r.body.toLowerCase()));
  const fresh = lines.filter((l) => !taken.has(l.toLowerCase()));
  if (!fresh.length) return { added: [], skipped: lines.length };
  const { data, error } = await db
    .from("icebreakers")
    .insert(fresh.map((body) => ({ body, spice })))
    .select("id, spice, body, active, created_at");
  if (error) return { added: [], skipped: 0, error: "Couldn't save. Please try again." };
  revalidatePath("/admin/icebreakers");
  return { added: (data ?? []) as Icebreaker[], skipped: lines.length - fresh.length };
}

/** Adds a mixed list of questions (each with its own spice level). */
export async function addIcebreakersBulk(items: { spice: number; body: string }[]): Promise<{ added: Icebreaker[]; skipped: number; error?: string }> {
  await requireAdmin();
  const clean_ = items
    .map((i) => ({ spice: i.spice, body: clean(i.body) }))
    .filter((i) => [0, 1, 2, 3].includes(i.spice) && i.body.length >= 5 && i.body.length <= 300)
    .slice(0, 2000);
  if (!clean_.length) return { added: [], skipped: 0, error: "No questions found. Put one question per line." };
  const db = createAdminClient();
  const taken = new Set<string>();
  for (let i = 0; i < clean_.length; i += 200) {
    const { data } = await db.from("icebreakers").select("body").is("event_id", null).in("body", clean_.slice(i, i + 200).map((x) => x.body));
    (data ?? []).forEach((r) => taken.add((r.body as string).toLowerCase()));
  }
  const fresh = clean_.filter((x) => !taken.has(x.body.toLowerCase()));
  if (!fresh.length) return { added: [], skipped: clean_.length };
  const { data, error } = await db.from("icebreakers").insert(fresh).select("id, spice, body, active, created_at");
  if (error) return { added: [], skipped: 0, error: "Couldn't save. Please try again." };
  revalidatePath("/admin/icebreakers");
  return { added: (data ?? []) as Icebreaker[], skipped: clean_.length - fresh.length };
}

export async function updateIcebreaker(id: number, patch: { body?: string; spice?: number; active?: boolean }) {
  await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.body !== undefined) {
    const b = clean(patch.body);
    if (b.length < 5 || b.length > 300) return { error: "Questions need 5–300 characters." };
    row.body = b;
  }
  if (patch.spice !== undefined) row.spice = patch.spice;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await createAdminClient().from("icebreakers").update(row).eq("id", id);
  if (error) return { error: "Couldn't save. Please try again." };
  return { ok: true };
}

export async function deleteIcebreaker(id: number) {
  await requireAdmin();
  const { error } = await createAdminClient().from("icebreakers").delete().eq("id", id);
  return error ? { error: "Couldn't delete." } : { ok: true };
}

// ---------------- Masquerade Nights ----------------

export type NightInput = {
  id?: string;
  title: string;
  description: string;
  theme: string;
  intent: string;
  starts_at: string; // ISO
  duration_min: number;
  age_min: number;
  age_max: number;
  entry_keys: number;
  max_attendees: number | null;
  status: "draft" | "published";
  questions: string;
};

export async function saveNight(input: NightInput): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  const title = clean(input.title);
  if (title.length < 3) return { error: "Give the night a title." };
  const start = new Date(input.starts_at);
  if (Number.isNaN(start.getTime())) return { error: "Pick a date and start time." };
  const minutes = Math.min(Math.max(Math.round(input.duration_min) || 60, 15), 360);
  if (input.age_min < 18 || input.age_max < input.age_min) return { error: "Check the age range (18+)." };
  const row = {
    title,
    description: input.description.trim().slice(0, 600),
    theme: input.theme,
    intent: input.intent,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    age_min: Math.round(input.age_min),
    age_max: Math.min(99, Math.round(input.age_max)),
    entry_keys: Math.max(0, Math.round(input.entry_keys) || 0),
    max_attendees: input.max_attendees && input.max_attendees > 0 ? Math.round(input.max_attendees) : null,
    status: input.status,
  };
  const db = createAdminClient();
  let id = input.id;
  if (id) {
    const { error } = await db.from("masquerade_events").update(row).eq("id", id);
    if (error) return { error: "Couldn't save the night." };
  } else {
    const { data, error } = await db.from("masquerade_events").insert(row).select("id").single();
    if (error || !data) return { error: "Couldn't create the night." };
    id = data.id as string;
  }
  // The night's own questions: replace the list
  const qs = [...new Set(input.questions.split("\n").map(clean).filter((l) => l.length >= 5 && l.length <= 300))];
  await db.from("icebreakers").delete().eq("event_id", id);
  if (qs.length) await db.from("icebreakers").insert(qs.map((body) => ({ body, spice: 1, event_id: id })));
  revalidatePath("/admin/nights");
  revalidatePath("/events");
  return { id };
}

export async function cancelNight(id: string) {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_cancel_event", { p_event: id });
  revalidatePath("/admin/nights");
  revalidatePath("/events");
  return error ? { error: "Couldn't cancel." } : { refunded: (data as number) ?? 0 };
}

export async function deleteNight(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db.from("event_attendees").select("user_id", { count: "exact", head: true }).eq("event_id", id);
  if (count) return { error: "People are going to this night. Cancel it instead (that refunds their Keys)." };
  const { error } = await db.from("masquerade_events").delete().eq("id", id);
  revalidatePath("/admin/nights");
  return error ? { error: "Couldn't delete." } : { ok: true };
}
