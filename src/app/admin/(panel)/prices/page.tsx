export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { PricesManager, type AdminGift, type AdminPack, type InviteStats } from "@/components/admin/PricesManager";

export default async function PricesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: settings }, { data: gifts }, { data: packs }, { data: invites }] = await Promise.all([
    db.from("app_settings").select("key, value"),
    db.from("gifts").select("id, name, emoji, price, sort, retired").order("sort"),
    db.from("key_packs").select("id, keys, naira, tag, sort, active").order("sort"),
    db.rpc("admin_invite_stats"),
  ]);
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key as string, r.value as number]));
  return (
    <PricesManager
      settings={{
        reopen_cost: s.reopen_cost ?? 10,
        reveal_cost: s.reveal_cost ?? 1,
        free_reveals: s.free_reveals ?? 10,
        invite_reward: s.invite_reward ?? 10,
        meet_cost: s.meet_cost ?? 10,
        meet_free_posts: s.meet_free_posts ?? 1,
        meet_hours: s.meet_hours ?? 3,
        explore_message_cost: s.explore_message_cost ?? 15,
        explore_photos_cost: s.explore_photos_cost ?? 5,
        explore_photos_paid: s.explore_photos_paid ?? 1,
        ghost_cost: s.ghost_cost ?? 100,
        wave_cost: s.wave_cost ?? 0,
        pair_gap_minutes: s.pair_gap_minutes ?? 60,
        pair_minutes: s.pair_minutes ?? 60,
        setup_reward: s.setup_reward ?? 5,
        signup_keys: s.signup_keys ?? 5,
        slow_reveal_cost: s.slow_reveal_cost ?? 10,
        gift_share_percent: s.gift_share_percent ?? 50,
        play_cost: s.play_cost ?? 1,
        sticker_pack_cost: s.sticker_pack_cost ?? 40,
        scribble_cost: s.scribble_cost ?? 1,
      }}
      invites={(invites as InviteStats | null) ?? null}
      gifts={(gifts ?? []) as AdminGift[]}
      packs={(packs ?? []) as AdminPack[]}
    />
  );
}
