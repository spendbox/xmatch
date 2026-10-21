import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { NightEditor } from "@/components/admin/NightEditor";
import type { AdminNight } from "@/components/admin/NightsList";

export default async function EditNightPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: all }, { data: qs }] = await Promise.all([
    db.rpc("admin_events"),
    db.from("icebreakers").select("body").eq("event_id", id).order("id"),
  ]);
  const night = ((all ?? []) as AdminNight[]).find((n) => n.id === id);
  if (!night) notFound();
  return <NightEditor night={night} questions={(qs ?? []).map((q) => q.body as string)} />;
}
