"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

export async function setFeedbackStatus(id: number, status: "new" | "done"): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("feedback").update({ status }).eq("id", id);
  if (error) return { error: "Couldn't update it. Please try again." };
  revalidatePath("/admin/feedback");
  return {};
}

export async function deleteFeedback(id: number): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("feedback").delete().eq("id", id);
  if (error) return { error: "Couldn't delete it. Please try again." };
  revalidatePath("/admin/feedback");
  return {};
}
