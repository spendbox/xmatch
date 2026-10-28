export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { HealthPage, type Health } from "@/components/admin/HealthPage";

/** Admin → Health: is Dashpad growing well? The few numbers that tell you, this week against last */
export default async function AdminHealth() {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_health");
  return <HealthPage health={(data as Health | null) ?? null} missing={!!error} />;
}
