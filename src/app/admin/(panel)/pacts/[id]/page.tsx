export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Pact, PactQuestion } from "@/lib/pacts";
import { PactEditor } from "@/components/admin/PactEditor";

export default async function PactEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: pact } = await db.from("pacts").select("*").eq("id", id).maybeSingle();
  if (!pact) notFound();
  const [{ data: questions }, { count }, { count: matches }] = await Promise.all([
    db.from("pact_questions").select("id, position, kind, title, subtitle, options, min_pick, max_pick, weight").eq("pact_id", id).order("position"),
    db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", id),
    db.from("pact_matches").select("id", { count: "exact", head: true }).eq("pact_id", id),
  ]);
  return <PactEditor pact={pact as Pact} questions={(questions ?? []) as PactQuestion[]} count={count ?? 0} matches={matches ?? 0} />;
}
