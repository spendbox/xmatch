export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { ThingsManager } from "@/components/admin/ThingsManager";
import type { ThingPromptRow } from "@/lib/things";

export default async function ThingsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [first, { data: counts }] = await Promise.all([
    db.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active, icon").order("sort").order("id"),
    db.rpc("admin_thing_counts"),
  ]);
  // Before update 114 the cards have no icons
  const { data: rows, error } = first.error ? await db.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active").order("sort").order("id") : first;
  return <ThingsManager rows={(rows ?? []) as ThingPromptRow[]} counts={(counts ?? {}) as Record<string, number>} missing={!!error} />;
}
