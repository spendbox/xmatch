export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { AdminTitle } from "@/components/admin/AdminShell";
import { ErrorsList, type ErrorRow } from "@/components/admin/ErrorsList";

export default async function ErrorsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("client_errors")
    .select("id, message, stack, url, agent, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = ((data ?? []) as unknown as (Omit<ErrorRow, "name"> & { profiles: { display_name: string | null } | null })[]).map((r) => ({
    ...r,
    name: r.profiles?.display_name ?? null,
  }));
  return (
    <>
      <AdminTitle title="App errors" subtitle="When something breaks on someone's phone, it shows up here. Send these to Claude to get them fixed, then clear them." />
      {error ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">Run update 82 in Supabase first.</p>
      ) : (
        <ErrorsList rows={rows} />
      )}
    </>
  );
}
