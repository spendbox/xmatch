export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { MasqueradeHealth, type MasqueradeStats } from "@/components/admin/MasqueradeHealth";

export default async function MasqueradeAdminPage() {
  await requireAdmin();
  const { data } = await createAdminClient().rpc("admin_masquerade_stats");
  return <MasqueradeHealth stats={data as MasqueradeStats | null} />;
}
