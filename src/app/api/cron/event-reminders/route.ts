import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { EMAIL_CAP, emailAttendees, type MailEvent } from "@/lib/eventEmails";

// Vercel Cron calls this once a day (see vercel.json) with "Authorization: Bearer CRON_SECRET".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOUR = 3_600_000;
const lagosDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });

  const db = createAdminClient();
  const now = Date.now();
  const { data: events, error } = await db
    .from("masquerade_events")
    .select("id, title, kind, starts_at, ends_at, settings")
    .eq("status", "published")
    .gt("starts_at", new Date(now).toISOString())
    .lt("starts_at", new Date(now + 36 * HOUR).toISOString())
    .order("starts_at");
  if (error) return NextResponse.json({ error: "Couldn't load events" }, { status: 500 });

  let budget = EMAIL_CAP;
  const report: { id: string; title: string; kind: string; sent: number; failed: number }[] = [];
  for (const e of (events ?? []) as (MailEvent & { settings: { reminders?: boolean } | null })[]) {
    if (budget <= 0) break;
    if (e.settings?.reminders === false) continue;
    const start = new Date(e.starts_at);
    const hours = (start.getTime() - now) / HOUR;
    const kind = hours < 12 ? "today" : "day";

    // Claim it first so it only ever goes out once
    const { error: claim } = await db.from("event_reminders").insert({ event_id: e.id, kind });
    if (claim) continue;

    const isToday = lagosDay(start) === lagosDay(new Date(now));
    const heading = isToday ? "It's today!" : "See you tomorrow";
    const message = isToday
      ? `${e.title} starts today. Come in a few minutes early so you don't miss a thing.`
      : `Just a reminder: ${e.title} is tomorrow. Put it in your calendar so you don't miss it.`;
    const res = await emailAttendees(e, { subject: isToday ? `Today: ${e.title}` : `Tomorrow: ${e.title}`, heading, message }, budget);
    budget -= res.sent + res.failed;
    report.push({ id: e.id, title: e.title, kind, ...res });
  }
  return NextResponse.json({ ok: true, report });
}
