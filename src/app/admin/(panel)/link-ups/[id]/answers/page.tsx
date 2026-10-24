export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { About, Answers, Pact, PactQuestion } from "@/lib/pacts";
import { PactInsights, type Insights, type PersonRow } from "@/components/admin/PactInsights";

const PER_PAGE = 50;

export default async function PactAnswersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const db = createAdminClient();
  const { data: pact } = await db.from("pacts").select("*").eq("id", id).maybeSingle();
  if (!pact) notFound();
  const [{ data: questions }, { data: insights }, { data: people }] = await Promise.all([
    db.from("pact_questions").select("id, position, kind, title, subtitle, options, min_pick, max_pick, weight").eq("pact_id", id).order("position"),
    db.rpc("pact_insights", { p_pact: id }),
    db
      .from("pact_entries")
      .select("id, email, user_id, about, answers, created_at, match_seen_at")
      .eq("pact_id", id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
  ]);
  return (
    <PactInsights
      pact={pact as Pact & { reveal_step: string | null; reveal_stats: Record<string, unknown> }}
      questions={(questions ?? []) as PactQuestion[]}
      insights={insights as Insights}
      people={(people ?? []) as (PersonRow & { about: About; answers: Answers })[]}
      page={page}
      perPage={PER_PAGE}
    />
  );
}
