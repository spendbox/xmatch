import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { intentLabel } from "@/lib/constants";
import type { Intent } from "@/lib/types";
import { revealDuePacts } from "@/lib/pactsServer";

// Called every 5 minutes by a scheduled job in Supabase (see the database setup page),
// with "Authorization: Bearer CRON_SECRET". Pairs everyone at the top of the hour, tells each new pair, and nudges quiet chats.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NewPair = { id: string; user_a: string; user_b: string; alias_a: string; alias_b: string; ends_at: string; intent: Intent };

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const started = Date.now();
  const db = createAdminClient();
  // Keep "usually replies in…" fresh: this runs every 5 minutes, 200 people at a time (it pairs quick repliers first)
  await db.rpc("refresh_reply_stats", { p_limit: 200 });
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
  // Nudge whoever has gone quiet in a live chat (once per chat)
  const { data: quiet } = await db.rpc("sessions_to_nudge");
  const nudges = (quiet ?? []) as { session_id: string; user_id: string; other_alias: string; ends_at: string }[];
  await Promise.all(
    nudges.map((n) =>
      pushToUsers(
        [n.user_id],
        {
          title: `${n.other_alias} is waiting for you 👀`,
          body: `Your masked chat ends at ${new Date(n.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })}. Say something before the hour is up.`,
          url: `/masquerade/${n.session_id}`,
          tag: `pair-${n.session_id}`,
        },
        { skipIfActive: true },
      ),
    ),
  );
  // Pacts whose reveal night has come (the every-minute pacts job does this too, if it's set up)
  let pacts: unknown[] = [];
  try {
    pacts = await revealDuePacts(started + 50_000);
  } catch (e) {
    console.error("pact reveal failed", e);
  }
  return NextResponse.json({ ok: true, made, told: pairs.length, sent, nudged: nudges.length, pacts });
}

export const GET = handle;
export const POST = handle;
