export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { MemberDetail, type MemberInfo } from "@/components/admin/MemberDetail";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await createAdminClient().rpc("admin_member", { p_id: id });
  const info = data as MemberInfo | null;
  if (!info?.profile) notFound();
  return <MemberDetail id={id} info={info} />;
}
