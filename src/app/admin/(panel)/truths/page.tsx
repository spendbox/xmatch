export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { TruthsManager } from "@/components/admin/TruthsManager";
import type { TruthRow, TruthStats } from "@/lib/truths";

export default async function TruthsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: rows, error }, { data: stats }, { data: today }, { data: hour }, { data: push }] = await Promise.all([
    db.from("truths").select("id, day, body, options, kind, active").order("day", { ascending: true, nullsFirst: false }).order("id"),
    db.rpc("admin_truth_stats"),
    db.rpc("truth_day"),
    db.from("app_settings").select("value").eq("key", "truths_hour").maybeSingle(),
    db.from("app_settings").select("value").eq("key", "truths_push").maybeSingle(),
  ]);
  return (
    <TruthsManager
      rows={(rows ?? []) as TruthRow[]}
      stats={(stats ?? {}) as TruthStats}
      today={(today as string | null) ?? new Date().toISOString().slice(0, 10)}
      hour={Number(hour?.value ?? 20)}
      push={push ? Number(push.value) !== 0 : null}
      missing={!!error}
    />
  );
}
