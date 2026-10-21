import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Save this phone/browser for push notifications. */
export async function POST(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const sub = ((await req.json().catch(() => ({}))) as { subscription?: Sub }).subscription;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Stop notifications on this phone/browser. */
export async function DELETE(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
