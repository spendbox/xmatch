"use server";

import { deleteKeys, deletePhotoFolder, keyFromUrl } from "@/lib/r2";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";

const refresh = (id: string) => {
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
};

/** Add (positive) or take away (negative) Keys, with a note in their history. */
export async function adjustKeys(id: string, amount: number, note: string) {
  await requireAdmin();
  const n = Math.trunc(amount);
  if (!n || Math.abs(n) > 100000) return { error: "Enter a number of Keys (not zero)." };
  const db = createAdminClient();
  const ref = note.trim().slice(0, 120) || "admin";
  if (n > 0) {
    const { error } = await db.rpc("add_keys", { uid: id, amount: n, reason: "admin", ref });
    if (error) return { error: "Couldn't add Keys." };
  } else {
    const { data: w } = await db.from("wallets").select("balance").eq("user_id", id).maybeSingle();
    const take = Math.min(-n, w?.balance ?? 0);
    if (!take) return { error: "They have no Keys to take away." };
    const { error } = await db.rpc("spend_keys", { uid: id, amount: take, reason: "admin", ref });
    if (error) return { error: "Couldn't take Keys away." };
  }
  refresh(id);
  return { ok: true };
}

/** Block someone from logging in and take them out of matching. */
export async function banMember(id: string, reason: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (error) return { error: "Couldn't ban this member." };
  await db.from("accounts_private").update({ banned_at: new Date().toISOString(), ban_reason: reason.trim().slice(0, 300) || null }).eq("user_id", id);
  await db.from("profiles").update({ open_to_masquerade: false }).eq("id", id);
  await db.from("masquerade_queue").delete().eq("user_id", id);
  refresh(id);
  return { ok: true };
}

export async function unbanMember(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: "none" });
  if (error) return { error: "Couldn't unban this member." };
  await db.from("accounts_private").update({ banned_at: null, ban_reason: null }).eq("user_id", id);
  refresh(id);
  return { ok: true };
}

/** Take down one photo (e.g. it breaks the rules). */
export async function removeMemberPhoto(id: string, url: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("photos").eq("id", id).single();
  const photos = ((p?.photos ?? []) as string[]).filter((x) => x !== url);
  const { error } = await db.from("profiles").update({ photos }).eq("id", id);
  if (error) return { error: "Couldn't remove the photo." };
  const marker = "/storage/v1/object/public/photos/";
  const i = url.indexOf(marker);
  if (i >= 0) await db.storage.from("photos").remove([decodeURIComponent(url.slice(i + marker.length))]);
  // Photos on R2: the photo and its small copy
  const key = keyFromUrl(url);
  if (key && key.startsWith(`photos/${id}/`)) await deleteKeys([key, key.replace(/(_t)?\.jpg$/, "_t.jpg")]);
  refresh(id);
  return { ok: true };
}

/** Permanently delete the account, photos, chats and Keys. */
export async function deleteMember(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: files } = await db.storage.from("photos").list(id, { limit: 100 });
  if (files?.length) await db.storage.from("photos").remove(files.map((f) => `${id}/${f.name}`));
  await deletePhotoFolder(id);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return { error: "Couldn't delete this member." };
  revalidatePath("/admin/members");
  return { ok: true };
}
