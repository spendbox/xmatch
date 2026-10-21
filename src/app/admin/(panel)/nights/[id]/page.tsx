export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { NightEditor } from "@/components/admin/NightEditor";
import type { AdminNight } from "@/components/admin/NightsList";
import { roomMessages, type AdminMedia } from "@/app/admin/(panel)/actions";

export default async function EditNightPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: all }, { data: qs }, { data: media }, room] = await Promise.all([
    db.rpc("admin_events"),
    db.from("icebreakers").select("body").eq("event_id", id).order("id"),
    db.from("event_media").select("id, kind, title, url, duration_sec, position").eq("event_id", id).order("position").order("id"),
    roomMessages(id),
  ]);
  const night = ((all ?? []) as AdminNight[]).find((n) => n.id === id);
  if (!night) notFound();
  return (
    <NightEditor
      night={night}
      questions={(qs ?? []).map((q) => q.body as string)}
      media={(media ?? []) as AdminMedia[]}
      room={room}
    />
  );
}
