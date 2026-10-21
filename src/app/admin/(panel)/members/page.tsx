export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { MembersList, type MemberRow } from "@/components/admin/MembersList";

const PAGE = 30;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string }> }) {
  await requireAdmin();
  const { q = "", f = "all", p = "1" } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const { data } = await createAdminClient().rpc("admin_members", { p_q: q.trim(), p_filter: f, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const res = (data ?? { total: 0, rows: [] }) as { total: number; rows: MemberRow[] };
  return <MembersList rows={res.rows} total={res.total} q={q} filter={f} page={page} pageSize={PAGE} />;
}
