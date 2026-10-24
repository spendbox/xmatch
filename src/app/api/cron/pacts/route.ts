import { NextResponse } from "next/server";
import { revealDuePacts } from "@/lib/pactsServer";

// Called every minute by a scheduled job in Supabase (set up by database update 40), with
// "Authorization: Bearer CRON_SECRET". Works on reveal night for any pact whose time has
// come: matching, starting chats, then telling everyone. Does nothing the rest of the time.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const pacts = await revealDuePacts(started + 50_000);
  return NextResponse.json({ ok: true, pacts });
}

export const GET = handle;
export const POST = handle;
