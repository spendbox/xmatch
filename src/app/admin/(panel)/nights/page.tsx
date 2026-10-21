export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { NightsList, type AdminNight } from "@/components/admin/NightsList";

export default async function NightsPage() {
  await requireAdmin();
  const { data } = await createAdminClient().rpc("admin_events");
  return <NightsList nights={(data ?? []) as AdminNight[]} />;
}
