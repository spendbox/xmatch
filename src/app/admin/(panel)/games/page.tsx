export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { GamesManager, type GameStats, type TotRow, type IdeaRow } from "@/components/admin/GamesManager";

export default async function GamesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: settings }, { data: questions }, { data: ideas }, { data: stats }, { data: stats1 }] = await Promise.all([
    db.from("app_settings").select("key, value").like("key", "game_%"),
    db.from("tot_questions").select("id, prompt, a, b, spice, active").order("spice").order("id"),
    db.from("truth_ideas").select("id, body, active").order("id"),
    db.rpc("admin_game_stats", { p_days: 7 }),
    db.rpc("admin_game_stats", { p_days: 1 }),
  ]);
  const on = Object.fromEntries((settings ?? []).map((r) => [(r.key as string).replace("game_", ""), r.value !== 0]));
  return (
    <GamesManager
      on={on}
      questions={(questions ?? []) as TotRow[]}
      ideas={(ideas ?? []) as IdeaRow[]}
      week={(stats as GameStats | null) ?? null}
      today={(stats1 as GameStats | null) ?? null}
    />
  );
}
