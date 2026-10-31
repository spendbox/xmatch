import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { intentLabel } from "@/lib/constants";
import type { Intent } from "@/lib/types";
import { revealDuePacts } from "@/lib/pactsServer";
import { deleteKeys } from "@/lib/r2";

// Called every 5 minutes by a scheduled job in Supabase (see the database setup page),
// with "Authorization: Bearer CRON_SECRET". Closes ended chats, pairs anyone online who is still waiting (live pairing happens on check-in), tells each new pair, and nudges quiet chats.
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
  const stats = await db.rpc("refresh_reply_stats", { p_limit: 200 });
  if (stats.error) console.error("reply stats failed", stats.error.message);
  // Pair in batches (each a few seconds) until everyone has had a turn, for up to ~40 seconds;
  // anyone left is picked up by the next run, 5 minutes later
  // Live pairing happens as people check in; this is the backup (and closes ended chats).
  // A problem here must not stop the notifications below, so it's noted and we carry on.
  let made = 0;
  let left = 0;
  let pairingError: string | null = null;
  for (;;) {
    const { data, error } = await db.rpc("run_hourly_pairing_batch", { p_budget: 500 });
    if (error) {
      pairingError = error.message;
      console.error("pairing batch failed", error.message);
      break;
    }
    const r = data as { made: number; left: number };
    made += r.made;
    left = r.left;
    if (!left || Date.now() - started > 40_000) break;
  }
  // Tell each new pair, a chunk at a time while there's time; anyone not told yet is told next run
  let told = 0;
  let sent = 0;
  while (Date.now() - started < 50_000) {
    const { data } = await db.rpc("hourly_pairs_to_notify", { p_limit: 400 });
    const pairs = (data ?? []) as NewPair[];
    if (!pairs.length) break;
    told += pairs.length;
    for (let i = 0; i < pairs.length; i += 50) {
      const res = await Promise.all(
        pairs.slice(i, i + 50).flatMap((p) => {
          const until = new Date(p.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
          const tell = (to: string, them: string) =>
            pushToUsers([to], {
              title: `You're paired with ${them}`,
              body: `Masked chat (${intentLabel(p.intent)}) open until ${until}.`,
              url: `/masquerade/${p.id}`,
              tag: `pair-${p.id}`,
            });
          return [tell(p.user_a, p.alias_b), tell(p.user_b, p.alias_a)];
        }),
      );
      sent += res.reduce((n, r) => n + r.sent, 0);
    }
    if (pairs.length < 400) break;
  }
  // Nudge whoever has gone quiet in a live chat (once per chat)
  const { data: quiet } = await db.rpc("sessions_to_nudge");
  const nudges = (quiet ?? []) as { session_id: string; user_id: string; other_alias: string; ends_at: string }[];
  await Promise.all(
    nudges.map((n) =>
      pushToUsers(
        [n.user_id],
        {
          title: `Your chat with ${n.other_alias} is still open`,
          body: `It ends at ${new Date(n.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })}.`,
          url: `/masquerade/${n.session_id}`,
          tag: `pair-${n.session_id}`,
        },
        { skipIfActive: true },
      ),
    ),
  );
  // Masked voice notes from chats that closed without unmasking: delete the files from storage
  let voiceDeleted = 0;
  try {
    const { data: due } = await db.rpc("masked_voice_due", { p_limit: 500 });
    const keys = (Array.isArray(due) ? due : []) as string[];
    if (keys.length) {
      await deleteKeys(keys);
      const { data: n } = await db.rpc("masked_voice_deleted", { p_keys: keys });
      voiceDeleted = (n as number) ?? 0;
    }
  } catch (e) {
    console.error("voice cleanup failed", e);
  }
  // Keys back for paid chats nobody replied to in 48 hours (before update 61 runs, this just does nothing)
  const { data: back } = await db.rpc("refund_quiet_paid_chats", { p_limit: 200 });
  // And chats paid for after a Play game (update 78)
  const { data: playBack } = await db.rpc("refund_quiet_play_chats", { p_limit: 200 });
  // Icebreakers nobody answered in time: Keys back to the sender (update 106; does nothing before it runs)
  await db.rpc("ice_expire");
  const refunds = [...(Array.isArray(back) ? back : []), ...(Array.isArray(playBack) ? playBack : [])] as {
    user_id: string;
    keys: number;
    session_id?: string;
    match_id?: string;
    name: string | null;
  }[];
  await Promise.all(
    refunds.map((r) =>
      pushToUsers([r.user_id], {
        title: `${r.keys} ${r.keys === 1 ? "Key" : "Keys"} returned to your wallet`,
        body: `${(r.name ?? "They").split(" ")[0]} didn't reply within 48 hours. The chat stays open.`,
        url: "/wallet",
        tag: `refund-${r.session_id ?? r.match_id}`,
      }),
    ),
  );
  // Pacts whose reveal night has come (the every-minute pacts job does this too, if it's set up)
  let pacts: unknown[] = [];
  try {
    pacts = await revealDuePacts(started + 50_000);
  } catch (e) {
    console.error("pact reveal failed", e);
  }
  return NextResponse.json({ ok: true, pairingError, made, left, told, sent, nudged: nudges.length, refunds: refunds.length, voiceDeleted, pacts });
}

export const GET = handle;
export const POST = handle;
