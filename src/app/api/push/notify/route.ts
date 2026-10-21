import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { GIFTS } from "@/lib/keys";

/**
 * Called by the app right after you do something the other person should hear about:
 * send a message, start a call, say hi at an event, or keep an event chat.
 * We check it really was you, then notify the other person.
 */
type Body = { kind?: string; matchId?: string; callId?: string; chatId?: string };

const RECENT_MS = 60_000;
const firstName = (n: string | null | undefined) => (n ?? "").split(" ")[0] || "Someone";

function preview(kind: string, body: string | null) {
  if (kind === "image") return "📷 Photo";
  if (kind === "video") return "🎬 Video";
  if (kind === "audio") return "🎤 Voice note";
  if (kind === "gift") {
    const g = GIFTS.find((x) => x.id === body);
    return `🎁 Sent you ${g ? `a ${g.name.toLowerCase()}` : "a gift"}`;
  }
  const t = (body ?? "").replace(/^💬 /, "");
  return t.length > 140 ? t.slice(0, 137) + "…" : t;
}

export async function POST(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const uid = user.id;
  const b = (await req.json().catch(() => ({}))) as Body;
  const db = createAdminClient();
  const ok = NextResponse.json({ ok: true });

  // A message (or gift) in a match chat
  if (b.kind === "message" && b.matchId) {
    const { data: m } = await db.from("matches").select("id, user_a, user_b").eq("id", b.matchId).maybeSingle();
    if (!m || (m.user_a !== uid && m.user_b !== uid)) return ok;
    const other = m.user_a === uid ? m.user_b : m.user_a;
    const { data: msg } = await db
      .from("messages")
      .select("kind, body, created_at")
      .eq("match_id", m.id)
      .eq("sender_id", uid)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!msg || Date.now() - new Date(msg.created_at as string).getTime() > RECENT_MS) return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    await pushToUsers(
      [other as string],
      {
        title: firstName(me?.display_name),
        body: preview(msg.kind as string, msg.body as string | null),
        url: `/matches/${m.id}`,
        tag: `match-${m.id}`,
        icon: (me?.photos as string[] | null)?.[0] ?? null,
      },
      { skipIfActive: true },
    );
    return ok;
  }

  // Someone is calling
  if (b.kind === "call" && b.callId) {
    const { data: c } = await db.from("calls").select("id, match_id, caller_id, callee_id, kind, status").eq("id", b.callId).maybeSingle();
    if (!c || c.caller_id !== uid || c.status !== "ringing") return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    await pushToUsers([c.callee_id as string], {
      title: c.kind === "video" ? "Incoming video call" : "Incoming voice call",
      body: `${firstName(me?.display_name)} is calling you on Dashpad`,
      url: `/matches/${c.match_id}`,
      tag: `call-${c.id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
      requireInteraction: true,
    });
    return ok;
  }

  // A message in a chat started at an event (people are still masked: alias, no photo)
  if (b.kind === "event_message" && b.chatId) {
    const { data: c } = await db.from("event_chats").select("id, event_id, user_a, user_b, status").eq("id", b.chatId).maybeSingle();
    if (!c || (c.user_a !== uid && c.user_b !== uid) || c.status !== "open") return ok;
    const other = c.user_a === uid ? c.user_b : c.user_a;
    const { data: msgs } = await db
      .from("event_chat_messages")
      .select("sender_id, body, created_at")
      .eq("chat_id", c.id)
      .order("id", { ascending: false })
      .limit(50);
    const mine = (msgs ?? []).find((x) => x.sender_id === uid);
    if (!mine || Date.now() - new Date(mine.created_at as string).getTime() > RECENT_MS) return ok;
    const [{ data: e }, { data: a }] = await Promise.all([
      db.from("masquerade_events").select("title").eq("id", c.event_id).single(),
      db.from("event_attendees").select("alias").eq("event_id", c.event_id).eq("user_id", uid).maybeSingle(),
    ]);
    const alias = (a?.alias as string | null) ?? "Someone";
    const first = (msgs ?? []).filter((x) => x.sender_id === uid).length === 1;
    await pushToUsers(
      [other as string],
      {
        title: first ? `${alias} said hi` : alias,
        body: first ? `At ${e?.title ?? "the event"}: ${preview("text", mine.body as string)}` : preview("text", mine.body as string),
        url: `/events/${c.event_id}/chat/${c.id}`,
        tag: `event-chat-${c.id}`,
      },
      { skipIfActive: true },
    );
    return ok;
  }

  // Both kept an event chat: it's a match
  if (b.kind === "event_match" && b.chatId) {
    const { data: c } = await db.from("event_chats").select("id, event_id, user_a, user_b, status, match_id").eq("id", b.chatId).maybeSingle();
    if (!c || (c.user_a !== uid && c.user_b !== uid) || c.status !== "matched" || !c.match_id) return ok;
    const other = c.user_a === uid ? c.user_b : c.user_a;
    const [{ data: me }, { data: e }] = await Promise.all([
      db.from("profiles").select("display_name, photos").eq("id", uid).single(),
      db.from("masquerade_events").select("title").eq("id", c.event_id).single(),
    ]);
    await pushToUsers([other as string], {
      title: "It's a match!",
      body: `You and ${firstName(me?.display_name)} both kept your chat from ${e?.title ?? "the event"}. Say hello.`,
      url: `/matches/${c.match_id}`,
      tag: `match-${c.match_id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  return ok;
}
