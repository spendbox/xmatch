import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { AdminOverview, type Overview } from "@/components/admin/AdminOverview";
import type { AdminNight } from "@/components/admin/NightsList";

export default async function AdminHome() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: overview }, { data: nights }] = await Promise.all([db.rpc("admin_overview"), db.rpc("admin_events")]);
  return <AdminOverview overview={overview as Overview} nights={(nights ?? []) as AdminNight[]} />;
}
