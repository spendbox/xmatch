import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { IcebreakerManager } from "@/components/admin/IcebreakerManager";
import type { Icebreaker } from "../actions";

export default async function IcebreakersPage() {
  await requireAdmin();
  const { data } = await createAdminClient()
    .from("icebreakers")
    .select("id, spice, body, active, created_at")
    .is("event_id", null)
    .order("spice")
    .order("id", { ascending: false })
    .limit(5000);
  return <IcebreakerManager initial={(data ?? []) as Icebreaker[]} />;
}
