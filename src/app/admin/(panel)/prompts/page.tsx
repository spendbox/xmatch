export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { PromptManager } from "@/components/admin/PromptManager";
import { lagosToday, type AdminPrompt } from "./actions";

export default async function PromptsPage() {
  if (!FEATURES.feed) redirect("/admin"); // Daily prompts are switched off
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.rpc("admin_prompts");
  return <PromptManager prompts={(data ?? []) as AdminPrompt[]} today={await lagosToday()} />;
}
