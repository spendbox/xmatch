import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { GIFTS } from "@/lib/keys";
import { intentLabel } from "@/lib/constants";
import type { Intent } from "@/lib/types";

/**
 * Called by the app right after you do something the other person should hear about:
 * send a message, start a call, say hi at an event, or keep an event chat.
 * We check it really was you, then notify the other person.
 */
type Body = { kind?: string; matchId?: string; callId?: string; chatId?: string; answerId?: string };

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

  // You masked up and nobody online fits: alert people who are open to Masquerade but away
  if (b.kind === "masquerade_wait") {
    const { data } = await db.rpc("masquerade_alert_targets", { p_from: uid, p_limit: 10 });
    const r = data as { from_age: number | null; from_gender: string | null; intent: Intent; targets: { user_id: string; distance_km: number | null }[] } | null;
    if (!r?.targets?.length) return ok;
    const sex = r.from_gender === "woman" ? "female" : r.from_gender === "man" ? "male" : "person";
    await Promise.all(
      r.targets.map((t) =>
        pushToUsers([t.user_id], {
          title: "Someone's masking up for you 🎭",
          body: `A ${r.from_age ? `${r.from_age}-year-old ` : ""}${sex}${t.distance_km !== null ? `, ${t.distance_km <= 1 ? "under 1 km" : `${t.distance_km} km`} away,` : ""} wants a masked chat (${intentLabel(r.intent)}). Tap to mask up.`,
          url: "/home?mask=1",
          tag: "masquerade-alert",
        }),
      ),
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

  // A message in a 24-hour chat from the Feed (shown by the name they go by in that chat)
  if (b.kind === "feed_message" && b.chatId) {
    const { data: c } = await db.from("feed_chats").select("id, user_a, user_b, alias_a, alias_b, status").eq("id", b.chatId).maybeSingle();
    if (!c || (c.user_a !== uid && c.user_b !== uid) || c.status !== "open") return ok;
    const other = c.user_a === uid ? c.user_b : c.user_a;
    const myAlias = (c.user_a === uid ? c.alias_a : c.alias_b) as string | null;
    const { data: msgs } = await db
      .from("feed_chat_messages")
      .select("sender_id, body, created_at")
      .eq("chat_id", c.id)
      .order("id", { ascending: false })
      .limit(50);
    const mine = (msgs ?? []).find((x) => x.sender_id === uid);
    if (!mine || Date.now() - new Date(mine.created_at as string).getTime() > RECENT_MS) return ok;
    let name = myAlias;
    let icon: string | null = null;
    if (!name) {
      const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
      name = firstName(me?.display_name);
      icon = (me?.photos as string[] | null)?.[0] ?? null;
    }
    const first = (msgs ?? []).filter((x) => x.sender_id === uid).length === 1;
    await pushToUsers(
      [other as string],
      {
        title: first ? `${name} wants to chat` : (name as string),
        body: first ? `About your answer on the Feed: ${preview("text", mine.body as string)}` : preview("text", mine.body as string),
        url: `/feed/chat/${c.id}`,
        tag: `feed-chat-${c.id}`,
        icon,
      },
      { skipIfActive: true },
    );
    return ok;
  }

  // Both kept a Feed chat
  if (b.kind === "feed_match" && b.chatId) {
    const { data: c } = await db.from("feed_chats").select("id, user_a, user_b, status, match_id").eq("id", b.chatId).maybeSingle();
    if (!c || (c.user_a !== uid && c.user_b !== uid) || c.status !== "matched" || !c.match_id) return ok;
    const other = c.user_a === uid ? c.user_b : c.user_a;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    await pushToUsers([other as string], {
      title: "It's a match!",
      body: `You and ${firstName(me?.display_name)} both kept your chat from the Feed. Masks off, say hello.`,
      url: `/matches/${c.match_id}`,
      tag: `match-${c.match_id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  // A gift on your Feed answer: they see who sent it
  if (b.kind === "feed_gift" && b.answerId) {
    const { data: g } = await db
      .from("prompt_gifts")
      .select("id, to_user, gift_id, created_at")
      .eq("answer_id", b.answerId)
      .eq("from_user", uid)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!g || Date.now() - new Date(g.created_at as string).getTime() > RECENT_MS) return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    const gift = GIFTS.find((x) => x.id === g.gift_id);
    await pushToUsers([g.to_user as string], {
      title: `${firstName(me?.display_name)} sent you ${gift ? `a ${gift.name.toLowerCase()} ${gift.emoji}` : "a gift"}`,
      body: "They loved your answer on the Feed. Chat back for free.",
      url: "/feed",
      tag: `feed-gift-${g.id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  return ok;
}
