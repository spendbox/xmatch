"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

export type AdminPrompt = {
  id: string;
  body: string;
  day: string;
  chat_cost: number;
  created_at: string;
  answers: number;
  hidden: number;
  reactions: number;
  gifts: number;
  chats: number;
  reports: number;
};

export type AdminAnswer = {
  id: string;
  alias: string;
  body: string;
  created_at: string;
  hidden_at: string | null;
  user_id: string;
  display_name: string | null;
  photo: string | null;
  reactions: number;
  gifts: number;
  reports: number;
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const cost = (n: number) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));

/** Today in Nigeria, as YYYY-MM-DD (prompts change at midnight Lagos time). */
export async function lagosToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function savePrompt(input: { id?: string; body: string; day: string; chat_cost: number }): Promise<{ error?: string }> {
  await requireAdmin();
  const body = clean(input.body);
  if (body.length < 3 || body.length > 300) return { error: "The prompt should be 3 to 300 characters." };
  if (!isDay(input.day)) return { error: "Pick a date." };
  const db = createAdminClient();
  const row = { body, day: input.day, chat_cost: cost(input.chat_cost) };
  const { error } = input.id ? await db.from("prompts").update(row).eq("id", input.id) : await db.from("prompts").insert(row);
  if (error) return { error: error.code === "23505" ? "There's already a prompt on that day." : "Couldn't save. Please try again." };
  revalidatePath("/admin/prompts");
  return {};
}

/** One prompt per line, placed on the next free days starting from `from`. */
export async function addPromptsBulk(text: string, from: string, chatCost: number): Promise<{ added: number; error?: string; last?: string }> {
  await requireAdmin();
  const lines = [...new Set(text.split("\n").map((l) => clean(l.replace(/^\s*(\d+[.)]|[-*•])\s*/, ""))).filter((l) => l.length >= 3 && l.length <= 300))].slice(0, 366);
  if (!lines.length) return { added: 0, error: "Write at least one prompt (one per line)." };
  if (!isDay(from)) return { added: 0, error: "Pick a start date." };
  const db = createAdminClient();
  const { data: taken } = await db.from("prompts").select("day").gte("day", from).lte("day", addDays(from, 800));
  const used = new Set((taken ?? []).map((r) => r.day as string));
  const rows: { body: string; day: string; chat_cost: number }[] = [];
  let day = from;
  for (const body of lines) {
    while (used.has(day)) day = addDays(day, 1);
    rows.push({ body, day, chat_cost: cost(chatCost) });
    used.add(day);
  }
  const { error } = await db.from("prompts").insert(rows);
  if (error) return { added: 0, error: "Couldn't save. Please try again." };
  revalidatePath("/admin/prompts");
  return { added: rows.length, last: rows[rows.length - 1].day };
}

export async function deletePrompt(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  await db.from("prompts").delete().eq("id", id);
  revalidatePath("/admin/prompts");
}

/** Swap two prompts' days (to reorder the schedule). */
export async function swapPromptDays(a: string, b: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.from("prompts").select("id, day").in("id", [a, b]);
  if (!data || data.length !== 2) return;
  const [x, y] = data as { id: string; day: string }[];
  // Park one on a far-away day first, because each day can hold only one prompt
  await db.from("prompts").update({ day: "1900-01-01" }).eq("id", x.id);
  await db.from("prompts").update({ day: x.day }).eq("id", y.id);
  await db.from("prompts").update({ day: y.day }).eq("id", x.id);
  revalidatePath("/admin/prompts");
}

export async function setAnswerHidden(id: string, hidden: boolean, promptId: string) {
  await requireAdmin();
  const db = createAdminClient();
  await db.from("prompt_answers").update({ hidden_at: hidden ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath(`/admin/prompts/${promptId}`);
}
