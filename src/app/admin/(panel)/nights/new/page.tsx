export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { NightEditor } from "@/components/admin/NightEditor";

export default async function NewNightPage() {
  await requireAdmin();
  const { data } = await createAdminClient().from("app_settings").select("key, value").in("key", ["reveal_cost", "free_reveals"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value as number | undefined;
  return <NightEditor defaults={{ reveal_cost: get("reveal_cost") ?? 1, free_reveals: get("free_reveals") ?? 10 }} />;
}
