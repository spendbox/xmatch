export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { AdminTitle } from "@/components/admin/AdminShell";

type Row = { id: number; message: string; stack: string | null; url: string | null; agent: string | null; created_at: string; profiles: { display_name: string | null } | null };

export default async function ErrorsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("client_errors")
    .select("id, message, stack, url, agent, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <AdminTitle title="App errors" subtitle="When the app breaks on someone's phone, it shows up here. Share these with Claude to get them fixed." />
      {error ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] shadow-card">Run update 82 in Supabase first.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] text-muted shadow-card">No errors yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.id} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[15px] font-bold break-words">{r.message}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}
                {r.profiles?.display_name ? ` · ${r.profiles.display_name}` : ""}
                {r.url ? ` · ${r.url}` : ""}
              </p>
              {r.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] font-semibold text-muted">Details</summary>
                  <pre className="mt-2 max-h-60 overflow-auto rounded-2xl bg-cream p-3 text-[11.5px] leading-snug whitespace-pre-wrap">{r.stack}</pre>
                  {r.agent && <p className="mt-1 text-[11.5px] text-muted">{r.agent}</p>}
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
