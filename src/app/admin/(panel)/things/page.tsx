export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { ThingsManager } from "@/components/admin/ThingsManager";
import type { ThingPromptRow } from "@/lib/things";

export default async function ThingsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: rows, error }, { data: counts }] = await Promise.all([
    db.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active").order("sort").order("id"),
    db.rpc("admin_thing_counts"),
  ]);
  return <ThingsManager rows={(rows ?? []) as ThingPromptRow[]} counts={(counts ?? {}) as Record<string, number>} missing={!!error} />;
}
