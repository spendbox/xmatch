"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { initializePayment } from "@/lib/paystack";
import { KEY_PACKS } from "@/lib/keys";

export async function buyKeys(packId: string): Promise<{ error: string } | void> {
  const { user } = await getAuth();
  if (!user) redirect("/login");
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Payments aren't set up yet. Please try again later." };
  }
  const admin = createAdminClient();
  // Prices come from the database (Admin → Prices); fall back to the built-in packs
  const { data: row } = await admin.from("key_packs").select("id, keys, naira, active").eq("id", packId).maybeSingle();
  const pack = row ? (row.active ? (row as { id: string; keys: number; naira: number }) : null) : KEY_PACKS.find((p) => p.id === packId);
  if (!pack) return { error: "Please choose a pack." };

  let email = user.email;
  if (!email) email = (await admin.auth.admin.getUserById(user.id)).data.user?.email ?? null;
  if (!email) return { error: "We couldn't find your email address." };

  const reference = `dp_${crypto.randomUUID().replace(/-/g, "")}`;
  const amountKobo = pack.naira * 100;
  const { error } = await admin.from("payments").insert({
    reference,
    user_id: user.id,
    pack_id: pack.id,
    keys: pack.keys,
    amount_kobo: amountKobo,
  });
  if (error) return { error: "Couldn't start the payment. Please try again." };

  let url: string;
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site";
    url = await initializePayment({
      email,
      amountKobo,
      reference,
      callbackUrl: `${site}/wallet`,
      metadata: { user_id: user.id, pack_id: pack.id, keys: pack.keys },
    });
  } catch {
    return { error: "Paystack is unavailable right now. Please try again." };
  }
  redirect(url);
}
