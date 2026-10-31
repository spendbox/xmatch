"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { APP_CONFIG_TAG } from "@/lib/appConfig";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

const int = (n: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

export async function saveSetting(
  key: "reopen_cost" | "reveal_cost" | "free_reveals" | "invite_reward" | "meet_cost" | "meet_free_posts" | "meet_hours" | "explore_message_cost" | "explore_photos_cost" | "explore_photos_paid" | "ghost_cost" | "wave_cost" | "pair_gap_minutes" | "pair_minutes" | "setup_reward" | "signup_keys" | "slow_reveal_cost" | "gift_share_percent" | "play_cost" | "sticker_pack_cost" | "scribble_cost" | "draw_together_cost" | "auto_suspend_reports" | "ice_free_per_day" | "ice_cost_card" | "ice_cost_this" | "ice_cost_voice" | "ice_cost_game",
  value: number,
) {
  await requireAdmin();
  const v = key === "meet_hours" ? int(value, 1, 48) : key === "pair_gap_minutes" ? int(value, 5, 1440) : key === "pair_minutes" ? int(value, 5, 180) : key === "explore_photos_paid" ? int(value, 0, 1) : key === "gift_share_percent" ? int(value, 0, 100) : key === "auto_suspend_reports" ? int(value, 0, 20) : key === "ice_free_per_day" ? int(value, 0, 50) : int(value, 0, 100000);
  const { error } = await createAdminClient().from("app_settings").upsert({ key, value: v, updated_at: new Date().toISOString() });
  revalidatePath("/admin/prices");
  revalidateTag(APP_CONFIG_TAG);
  revalidatePath("/admin/health");
  return error ? { error: "Couldn't save." } : {};
}

export async function saveGift(id: string, patch: { name: string; price: number; retired: boolean }) {
  await requireAdmin();
  const name = patch.name.replace(/\s+/g, " ").trim().slice(0, 30);
  if (!name) return { error: "Give it a name." };
  const { error } = await createAdminClient().from("gifts").update({ name, price: int(patch.price, 1, 100000), retired: !!patch.retired }).eq("id", id);
  revalidatePath("/admin/prices");
  revalidateTag(APP_CONFIG_TAG);
  revalidatePath("/admin/health");
  return error ? { error: "Couldn't save." } : {};
}

export async function savePack(id: string, patch: { keys: number; naira: number; tag: string; active: boolean }) {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("key_packs")
    .update({ keys: int(patch.keys, 1, 1000000), naira: int(patch.naira, 50, 100000000), tag: patch.tag.trim().slice(0, 20) || null, active: !!patch.active })
    .eq("id", id);
  revalidatePath("/admin/prices");
  revalidateTag(APP_CONFIG_TAG);
  revalidatePath("/admin/health");
  return error ? { error: "Couldn't save." } : {};
}

export async function addPack() {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db.from("key_packs").select("id", { count: "exact", head: true });
  const id = `p${Date.now().toString(36)}`;
  await db.from("key_packs").insert({ id, keys: 100, naira: 1500, sort: (count ?? 0) + 1, active: false });
  revalidatePath("/admin/prices");
  revalidateTag(APP_CONFIG_TAG);
  revalidatePath("/admin/health");
}
