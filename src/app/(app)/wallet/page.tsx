import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyPayment } from "@/lib/paystack";
import type { Wallet } from "@/lib/keys";
import { WalletScreen, type KeyTx } from "@/components/keys/WalletScreen";

export const metadata = { title: "Keys" };

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const { supabase, user } = await getAuth();
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref;

  // Back from Paystack: confirm the payment with Paystack before adding Keys
  let result: "paid" | "pending" | "failed" | null = null;
  if (reference && user && process.env.PAYSTACK_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const check = await verifyPayment(reference).catch(() => null);
    if (check?.status === "success" && check.currency === "NGN") {
      const { data } = await createAdminClient().rpc("complete_payment", { p_reference: reference, p_amount_kobo: check.amount });
      result = data === "paid" || data === "already_paid" ? "paid" : "failed";
    } else if (check && ["abandoned", "failed", "reversed"].includes(check.status)) {
      result = "failed";
    } else {
      result = "pending";
    }
  }

  const [{ data: wallet }, { data: history }] = await Promise.all([
    supabase.rpc("my_wallet"),
    supabase.from("key_transactions").select("id, amount, reason, created_at").order("id", { ascending: false }).limit(30),
  ]);

  return <WalletScreen userId={user!.id} wallet={wallet as Wallet} history={(history ?? []) as KeyTx[]} result={result} />;
}
