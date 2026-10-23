"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

const int = (n: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

export async function saveSetting(
  key: "reopen_cost" | "reveal_cost" | "free_reveals" | "invite_reward" | "meet_cost" | "meet_free_posts" | "meet_hours" | "explore_message_cost" | "explore_photos_cost" | "ghost_cost",
  value: number,
) {
  await requireAdmin();
  const v = key === "meet_hours" ? int(value, 1, 48) : int(value, 0, 100000);
  const { error } = await createAdminClient().from("app_settings").upsert({ key, value: v, updated_at: new Date().toISOString() });
  revalidatePath("/admin/prices");
  return error ? { error: "Couldn't save." } : {};
}

export async function saveGift(id: string, patch: { name: string; price: number; retired: boolean }) {
  await requireAdmin();
  const name = patch.name.replace(/\s+/g, " ").trim().slice(0, 30);
  if (!name) return { error: "Give it a name." };
  const { error } = await createAdminClient().from("gifts").update({ name, price: int(patch.price, 1, 100000), retired: !!patch.retired }).eq("id", id);
  revalidatePath("/admin/prices");
  return error ? { error: "Couldn't save." } : {};
}

export async function savePack(id: string, patch: { keys: number; naira: number; tag: string; active: boolean }) {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("key_packs")
    .update({ keys: int(patch.keys, 1, 1000000), naira: int(patch.naira, 50, 100000000), tag: patch.tag.trim().slice(0, 20) || null, active: !!patch.active })
    .eq("id", id);
  revalidatePath("/admin/prices");
  return error ? { error: "Couldn't save." } : {};
}

export async function addPack() {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db.from("key_packs").select("id", { count: "exact", head: true });
  const id = `p${Date.now().toString(36)}`;
  await db.from("key_packs").insert({ id, keys: 100, naira: 1500, sort: (count ?? 0) + 1, active: false });
  revalidatePath("/admin/prices");
}
