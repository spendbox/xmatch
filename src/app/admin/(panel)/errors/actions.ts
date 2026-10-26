"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

/** Fixed: clear every report of this error (or all of them) */
export async function clearErrors(message?: string): Promise<{ error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const q = db.from("client_errors").delete();
  const { error } = message ? await q.eq("message", message) : await q.gt("id", 0);
  if (error) return { error: "Couldn't clear. Please try again." };
  revalidatePath("/admin/errors");
  return {};
}
