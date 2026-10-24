export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { FeedbackInbox, type FeedbackRow } from "@/components/admin/FeedbackInbox";

const PAGE = 40;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ f?: string; p?: string }> }) {
  await requireAdmin();
  const { f = "new", p = "1" } = await searchParams;
  const filter = f === "done" || f === "all" ? f : "new";
  const page = Math.max(1, Math.floor(Number(p) || 1));
  const db = createAdminClient();
  let q = db
    .from("feedback")
    .select("id, kind, message, page, device, status, created_at, user_id, profiles(display_name, photos)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (filter !== "all") q = q.eq("status", filter);
  const [{ data, count, error }, { count: fresh }] = await Promise.all([q, db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new")]);
  return <FeedbackInbox rows={(data ?? []) as unknown as FeedbackRow[]} total={count ?? 0} fresh={fresh ?? 0} filter={filter} page={page} pageSize={PAGE} missing={!!error} />;
}
