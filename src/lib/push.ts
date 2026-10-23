import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

export type PushPayload = {
  title: string;
  body: string;
  /** Page to open when they tap it */
  url: string;
  /** Notifications with the same tag replace each other (e.g. one per chat) */
  tag?: string;
  icon?: string | null;
  /** Keep it on screen until they act (calls) */
  requireInteraction?: boolean;
};

let ready: boolean | null = null;
function setup() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@dashpad.site", pub, priv);
  return (ready = true);
}

/**
 * Send a notification to everyone listed, on every phone/browser they turned notifications on.
 * skipIfActive: don't buzz people who are using Dashpad right now (they'll see it in the app).
 */
export async function pushToUsers(userIds: string[], payload: PushPayload, opts: { skipIfActive?: boolean } = {}) {
  if (!setup() || !userIds.length) return { sent: 0 };
  const db = createAdminClient();
  let ids = [...new Set(userIds)];
  if (opts.skipIfActive) {
    const { data } = await db.from("profiles").select("id, last_seen_at").in("id", ids);
    const active = new Set((data ?? []).filter((p) => Date.now() - new Date(p.last_seen_at as string).getTime() < 90_000).map((p) => p.id as string));
    ids = ids.filter((id) => !active.has(id));
    if (!ids.length) return { sent: 0 };
  }
  let sent = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids.slice(i, i + 200));
    const gone: number[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
            JSON.stringify(payload),
            { TTL: payload.requireInteraction ? 60 : 60 * 60 * 12, urgency: "high" },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // The phone unsubscribed or the browser was reset: forget it
          if (code === 404 || code === 410) gone.push(s.id as number);
        }
      }),
    );
    if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  }
  return { sent };
}
