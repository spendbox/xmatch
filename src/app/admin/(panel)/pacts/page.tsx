export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { PactsAdmin, type AdminPact } from "@/components/admin/PactsAdmin";

export default async function PactsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.from("pacts").select("id, slug, name, accent, logo_url, status, closes_at, reveal_at, matched_at, created_at").order("created_at", { ascending: false });
  const pacts = (data ?? []) as Omit<AdminPact, "count" | "matches">[];
  const counts = await Promise.all(
    pacts.map(async (p) => {
      const [{ count }, { count: matches }] = await Promise.all([
        db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", p.id),
        db.from("pact_matches").select("id", { count: "exact", head: true }).eq("pact_id", p.id),
      ]);
      return { count: count ?? 0, matches: matches ?? 0 };
    }),
  );
  return <PactsAdmin pacts={pacts.map((p, i) => ({ ...p, ...counts[i] }))} />;
}
