"use server";

import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export type FeedbackKind = "feedback" | "bug" | "help" | "idea";
const KINDS: FeedbackKind[] = ["feedback", "bug", "help", "idea"];

/** Saves a message from the support button. Up to 10 an hour per person. */
export async function sendFeedback(input: { kind: string; message: string; page?: string; device?: string }): Promise<{ error?: string }> {
  const { user } = await getAuth();
  if (!user) return { error: "Please log in again." };
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 2000) : "";
  if (message.length < 2) return { error: "Write a little more so we can help." };
  const kind = KINDS.includes(input.kind as FeedbackKind) ? (input.kind as FeedbackKind) : "feedback";
  const db = createAdminClient();
  const { count } = await db
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return { error: "You've sent a lot in the last hour. Please try again a bit later." };
  const { error } = await db.from("feedback").insert({
    user_id: user.id,
    kind,
    message,
    page: typeof input.page === "string" ? input.page.slice(0, 200) : null,
    device: typeof input.device === "string" ? input.device.slice(0, 300) : null,
  });
  if (error) return { error: "Couldn't send it. Please try again." };
  return {};
}
