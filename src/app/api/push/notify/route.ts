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
type Body = { kind?: string; matchId?: string; callId?: string; chatId?: string; answerId?: string; sessionId?: string; gameId?: string };

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

  // You were the second to unmask an hourly pair: tell the other person you clicked
  if (b.kind === "masquerade_match" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, status, match_id").eq("id", b.sessionId).maybeSingle();
    if (!s || (s.user_a !== uid && s.user_b !== uid) || s.status !== "matched" || !s.match_id) return ok;
    const other = s.user_a === uid ? s.user_b : s.user_a;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    await pushToUsers([other as string], {
      title: "You clicked! 🎭",
      body: `You and ${firstName(me?.display_name)} both unmasked. Say hello.`,
      url: `/matches/${s.match_id}`,
      tag: `match-${s.match_id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  // Someone paid to reopen a past masked pair: tell the other person
  if (b.kind === "masquerade_reopen" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, alias_a, alias_b, reopened_by, status").eq("id", b.sessionId).maybeSingle();
    if (!s || s.reopened_by !== uid || s.status !== "active") return ok;
    const other = s.user_a === uid ? s.user_b : s.user_a;
    const alias = s.user_a === uid ? s.alias_a : s.alias_b;
    await pushToUsers([other as string], {
      title: `${alias} reopened your chat 🎭`,
      body: "They want to pick up where you left off. Still masked, until you both decide.",
      url: `/masquerade/${s.id}`,
      tag: `pair-${s.id}`,
    });
    return ok;
  }

  // You tapped Meet on someone's post: tell them (still masked)
  if (b.kind === "meet_join" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, alias_b, meet_id, started_at").eq("id", b.sessionId).maybeSingle();
    if (!s || s.user_b !== uid || !s.meet_id || Date.now() - new Date(s.started_at as string).getTime() > RECENT_MS) return ok;
    const { data: m } = await db.from("meet_posts").select("kind, game").eq("id", s.meet_id).single();
    const title = ({ truths: "Two Truths & a Lie", tot: "This or That", c4: "Connect 4", words: "Word Hunt" } as Record<string, string>)[(m?.game as string) ?? ""];
    await pushToUsers([s.user_a as string], {
      title: `${s.alias_b} wants to meet you 🎭`,
      body: m?.kind === "game" && title ? `They're in line to play ${title}. Still masked, until you both decide.` : "They opened a masked chat from your post. Say hi.",
      url: `/masquerade/${s.id}`,
      tag: `meet-${s.id}`,
    });
    return ok;
  }

  // You challenged someone to a game in a chat
  if (b.kind === "game_invite" && b.gameId) {
    const { data: g } = await db
      .from("games")
      .select("id, kind, player_a, player_b, status, session_id, match_id, created_at")
      .eq("id", b.gameId)
      .maybeSingle();
    if (!g || g.player_a !== uid || g.status !== "invited" || Date.now() - new Date(g.created_at as string).getTime() > 30_000) return ok;
    const title = ({ truths: "Two Truths & a Lie", tot: "This or That", c4: "Connect 4", words: "Word Hunt" } as Record<string, string>)[g.kind as string] ?? "a game";
    let who = "Someone";
    let url = "/home";
    let icon: string | null = null;
    if (g.session_id) {
      const { data: s } = await db.from("masquerade_sessions").select("user_a, alias_a, alias_b").eq("id", g.session_id).single();
      who = s ? (s.user_a === uid ? s.alias_a : s.alias_b) : who;
      url = `/masquerade/${g.session_id}`;
    } else {
      const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
      who = firstName(me?.display_name);
      icon = (me?.photos as string[] | null)?.[0] ?? null;
      url = `/matches/${g.match_id}`;
    }
    await pushToUsers([g.player_b as string], {
      title: `${who} challenged you 🎮`,
      body: `${title}. You have 30 seconds to accept.`,
      url,
      tag: `game-${g.id}`,
      icon,
      requireInteraction: true,
    });
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
      title: "You clicked!",
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
      title: "You clicked!",
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
