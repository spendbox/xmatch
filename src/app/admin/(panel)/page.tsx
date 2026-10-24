export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { AdminOverview, type Overview } from "@/components/admin/AdminOverview";
import type { AdminNight } from "@/components/admin/NightsList";
import { StorageCheck } from "@/components/admin/StorageCheck";

export default async function AdminHome() {
  await requireAdmin();
  const db = createAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const [{ data: overview }, { data: nights }, { data: prompts }] = await Promise.all([
    db.rpc("admin_overview"),
    db.rpc("admin_events"),
    db.from("prompts").select("day").gte("day", today).order("day").limit(60),
  ]);
  // How many days in a row, starting today, already have a prompt
  const days = new Set((prompts ?? []).map((p) => p.day as string));
  let ahead = 0;
  for (const d = new Date(today + "T12:00:00Z"); days.has(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1)) ahead++;
  return (
    <>
      <AdminOverview overview={overview as Overview} nights={(nights ?? []) as AdminNight[]} promptsAhead={ahead} />
      <StorageCheck />
    </>
  );
}
