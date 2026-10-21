import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { eventEmail, sendEmailBatch } from "@/lib/email";
import { kindLabel } from "@/lib/events";

/** Most emails sent in one go, so a run never takes too long. */
export const EMAIL_CAP = 500;

// Members are mostly in Nigeria, so emails show West Africa time
const TZ = "Africa/Lagos";

export function emailWhen(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const day = s.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)} – ${t(new Date(endIso))} (WAT)`;
}

export type MailEvent = { id: string; title: string; kind: string; starts_at: string; ends_at: string };

/** Email addresses of everyone going to an event. */
export async function attendeeEmails(eventId: string) {
  const db = createAdminClient();
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("event_attendees").select("user_id").eq("event_id", eventId).range(from, from + 999);
    (data ?? []).forEach((r) => ids.push(r.user_id as string));
    if (!data || data.length < 1000) break;
  }
  const emails: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("accounts_private").select("email").in("user_id", ids.slice(i, i + 200));
    (data ?? []).forEach((r) => r.email && emails.push(r.email as string));
  }
  return [...new Set(emails.map((e) => e.trim()).filter((e) => e.includes("@")))];
}

/** Sends one email to each person going (in batches of 100). */
export async function emailAttendees(
  e: MailEvent,
  copy: { subject: string; heading: string; message: string; button?: string },
  cap = EMAIL_CAP,
) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site").replace(/\/$/, "");
  const { html, text } = eventEmail({
    heading: copy.heading,
    message: copy.message,
    button: copy.button,
    title: e.title,
    when: emailWhen(e.starts_at, e.ends_at),
    kind: kindLabel(e.kind),
    link: `${site}/events/${e.id}`,
  });
  const to = (await attendeeEmails(e.id)).slice(0, cap);
  if (!to.length) return { sent: 0, failed: 0 };
  return sendEmailBatch({ to, subject: copy.subject, html, text });
}
