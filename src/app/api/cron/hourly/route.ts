import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { intentLabel } from "@/lib/constants";
import type { Intent } from "@/lib/types";

// Called at the top of every hour by a scheduled job in Supabase (see the database setup page),
// with "Authorization: Bearer CRON_SECRET". Pairs everyone for the hour, then tells each new pair.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NewPair = { id: string; user_a: string; user_b: string; alias_a: string; alias_b: string; ends_at: string; intent: Intent };

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: made, error } = await db.rpc("run_hourly_pairing");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = await db.rpc("hourly_pairs_to_notify");
  const pairs = (data ?? []) as NewPair[];
  let sent = 0;
  for (let i = 0; i < pairs.length; i += 20) {
    const res = await Promise.all(
      pairs.slice(i, i + 20).flatMap((p) => {
        const until = new Date(p.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
        const tell = (to: string, them: string) =>
          pushToUsers([to], {
            title: "Your new pair is here 🎭",
            body: `You're paired with ${them} (${intentLabel(p.intent)}) until ${until}. Say hi while you're both masked.`,
            url: `/masquerade/${p.id}`,
            tag: `pair-${p.id}`,
          });
        return [tell(p.user_a, p.alias_b), tell(p.user_b, p.alias_a)];
      }),
    );
    sent += res.reduce((n, r) => n + r.sent, 0);
  }
  return NextResponse.json({ ok: true, made, told: pairs.length, sent });
}

export const GET = handle;
export const POST = handle;
