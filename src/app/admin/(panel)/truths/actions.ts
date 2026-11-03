"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { TRUTH_KINDS, type TruthRow } from "@/lib/truths";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const IDS = ["a", "b", "c", "d"];

/** Add or change a Truth. A date that's taken swaps with the Truth that had it */
export async function saveTruth(input: {
  id?: number;
  body: string;
  options: string[];
  kind: string;
  day: string | null;
  active: boolean;
}): Promise<{ error?: string; row?: TruthRow }> {
  await requireAdmin();
  const body = clean(input.body);
  if (body.length < 5 || body.length > 160) return { error: "The question should be 5 to 160 characters." };
  const labels = [...new Set(input.options.map((o) => clean(o).slice(0, 40)).filter(Boolean))];
  if (labels.length < 2 || labels.length > 4) return { error: "Give 2 to 4 answers, one per line." };
  const day = input.day && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : null;
  const db = createAdminClient();

  // People who already answered keep their letter, so only relabel what's there
  let options = labels.map((label, i) => ({ id: IDS[i], label }));
  let oldDay: string | null = null;
  if (input.id) {
    const { data: was } = await db.from("truths").select("day, options").eq("id", input.id).maybeSingle();
    if (!was) return { error: "That Truth is gone. Refresh the page." };
    oldDay = (was.day as string | null) ?? null;
    const prev = (was.options as { id: string; label: string }[]) ?? [];
    const { count } = await db.from("truth_answers").select("id", { count: "exact", head: true }).eq("truth_id", input.id);
    if (count && labels.length < prev.length) return { error: "People have answered this one, so you can't remove answers. You can rename them." };
    options = labels.map((label, i) => ({ id: prev[i]?.id ?? IDS[i], label }));
  }

  // The date belongs to another Truth: give that one this Truth's old date
  let swapped: number | null = null;
  if (day && day !== oldDay) {
    const { data: other } = await db.from("truths").select("id").eq("day", day).maybeSingle();
    if (other) {
      swapped = other.id as number;
      const { error } = await db.from("truths").update({ day: null }).eq("id", swapped);
      if (error) return { error: "Couldn't move the other Truth off that date." };
    }
  }

  const row = { body, options, kind: input.kind in TRUTH_KINDS ? input.kind : "light", day, active: !!input.active };
  const res = input.id
    ? await db.from("truths").update(row).eq("id", input.id).select("id, day, body, options, kind, active").single()
    : await db.from("truths").insert(row).select("id, day, body, options, kind, active").single();
  if (res.error) return { error: input.id ? "Couldn't save. Please try again." : "Couldn't add it. Please try again." };
  if (swapped && oldDay) await db.from("truths").update({ day: oldDay }).eq("id", swapped);
  revalidatePath("/admin/truths");
  return { row: res.data as TruthRow };
}

export async function deleteTruth(id: number): Promise<{ error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db.from("truth_answers").select("id", { count: "exact", head: true }).eq("truth_id", id);
  if (count) return { error: "People have answered this one. Hide it instead." };
  const { error } = await db.from("truths").delete().eq("id", id);
  if (error) return { error: "Couldn't delete it." };
  revalidatePath("/admin/truths");
  return {};
}

export type TruthVoiceRow = { id: number; alias: string; choice: string; voice_key: string; voice_seconds: number | null; listens: number; hidden: boolean; created_at: string };

/** The voice answers on one Truth, for checking */
export async function truthVoices(id: number): Promise<TruthVoiceRow[]> {
  await requireAdmin();
  const { data } = await createAdminClient()
    .from("truth_answers")
    .select("id, alias, choice, voice_key, voice_seconds, listens, hidden, created_at")
    .eq("truth_id", id)
    .not("voice_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as TruthVoiceRow[];
}

/** Hide a voice answer nobody should hear (or bring it back) */
export async function hideTruthVoice(id: number, hidden: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("truth_answers").update({ hidden }).eq("id", id);
  return error ? { error: "Couldn't change it." } : {};
}

/** The hour a new Truth starts (Lagos time) */
export async function setTruthHour(hour: number): Promise<{ error?: string }> {
  await requireAdmin();
  const h = Math.max(0, Math.min(23, Math.round(hour)));
  const { error } = await createAdminClient().from("app_settings").upsert({ key: "truths_hour", value: h, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save the time." };
  revalidatePath("/admin/truths");
  return {};
}

/** Turn the "Today's Truth is up" notification on or off */
export async function setTruthPush(on: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("app_settings").upsert({ key: "truths_push", value: on ? 1 : 0, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save." };
  revalidatePath("/admin/truths");
  return {};
}
