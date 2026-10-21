export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { IcebreakerManager } from "@/components/admin/IcebreakerManager";
import type { Icebreaker } from "../actions";

export default async function IcebreakersPage() {
  await requireAdmin();
  const db = createAdminClient();
  // The database sends at most 1,000 rows per request, so read them in pages
  const all: Icebreaker[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await db
      .from("icebreakers")
      .select("id, spice, body, active, created_at")
      .is("event_id", null)
      .order("spice")
      .order("id", { ascending: false })
      .range(from, from + 999);
    if (!data?.length) break;
    all.push(...(data as Icebreaker[]));
    if (data.length < 1000) break;
  }
  return <IcebreakerManager initial={all} />;
}
