"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { deletePhotoFolder } from "@/lib/r2";

/** Permanently deletes the account, photos, matches and messages. */
export async function deleteAccount(confirm: string): Promise<{ error?: string } | void> {
  // They have to type DELETE first (checked here too, not just on the phone)
  if (confirm.trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Account deletion isn't set up yet. Email support@dashpad.site." };

  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("photos").list(user.id, { limit: 100 });
  if (files?.length) await admin.storage.from("photos").remove(files.map((f) => `${user.id}/${f.name}`));
  await deletePhotoFolder(user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Couldn't delete your account. Please try again or email support@dashpad.site." };

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
