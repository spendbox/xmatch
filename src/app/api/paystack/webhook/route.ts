import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validSignature } from "@/lib/paystack";

// Paystack calls this when a payment succeeds, even if the person closed the page.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = JSON.parse(raw) as { event: string; data: { status: string; reference: string; amount: number; currency: string } };
  if (event.event === "charge.success" && event.data.status === "success" && event.data.currency === "NGN") {
    await createAdminClient().rpc("complete_payment", { p_reference: event.data.reference, p_amount_kobo: event.data.amount });
  }
  return NextResponse.json({ received: true });
}
