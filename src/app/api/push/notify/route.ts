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
type Body = { kind?: string; personId?: string; matchId?: string; callId?: string; chatId?: string; answerId?: string; sessionId?: string; gameId?: string; iceId?: string };

const RECENT_MS = 60_000;
const firstName = (n: string | null | undefined) => (n ?? "").split(" ")[0] || "Someone";

/**
 * In chats started from Meet the other person may already know your name: if you both
 * waved, or they paid to message you (you're user_b). Then notifications use it, not your mask.
 */
async function senderLabel(
  db: ReturnType<typeof createAdminClient>,
  s: { source?: string | null; waved?: boolean | null; pact_id?: string | null; meet_id?: string | null; user_b: string },
  uid: string,
  alias: string,
) {
  const knows = s.source === "explore" && !s.pact_id && !s.meet_id && (s.waved || s.user_b === uid);
  if (!knows) return alias;
  const { data } = await db.from("profiles").select("display_name").eq("id", uid).single();
  return firstName(data?.display_name as string | null) || alias;
}

function preview(kind: string, body: string | null, slow = false) {
  if (kind === "image") return slow ? "Sent a photo" : "Photo";
  if (kind === "video") return slow ? "Sent a video" : "Video";
  if (kind === "audio") return "Voice note";
  if (kind === "sticker") return "Sent a sticker";
  if (kind === "scribble") return body === "Drawing" ? "Sent your drawing" : "Sent a scribble";
  if (kind === "draw") return "Started a drawing for you both";
  if (kind === "gift") {
    const g = GIFTS.find((x) => x.id === body);
    return `Sent ${g ? `a ${g.name.toLowerCase()}` : "a gift"}`;
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
      .select("kind, body, created_at, slow")
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
        body: preview(msg.kind as string, msg.body as string | null, !!msg.slow),
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
          title: "New masked chat request on Dashpad",
          body: `A ${r.from_age ? `${r.from_age}-year-old ` : ""}${sex}${t.distance_km !== null ? ` ${t.distance_km <= 1 ? "under 1 km" : `${t.distance_km} km`} away` : ""} is looking for a masked chat (${intentLabel(r.intent)}). Open Dashpad to join.`,
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
      title: `You matched with ${firstName(me?.display_name)}`,
      body: "You both unmasked. Your chat is open.",
      url: `/matches/${s.match_id}`,
      tag: `match-${s.match_id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  // You unmasked first: tell the other person, so they can unmask too
  if (b.kind === "masquerade_unmask" && b.sessionId) {
    const { data: s } = await db
      .from("masquerade_sessions")
      .select("id, user_a, user_b, alias_a, alias_b, unmask_a, unmask_b, status, source, waved, pact_id, meet_id")
      .eq("id", b.sessionId)
      .maybeSingle();
    if (!s || (s.user_a !== uid && s.user_b !== uid) || (s.status !== "active" && s.status !== "lapsed")) return ok;
    const iAmA = s.user_a === uid;
    if ((iAmA ? s.unmask_a : s.unmask_b) !== true || (iAmA ? s.unmask_b : s.unmask_a) === true) return ok;
    const who = await senderLabel(db, s, uid, (iAmA ? s.alias_a : s.alias_b) as string);
    await pushToUsers([(iAmA ? s.user_b : s.user_a) as string], {
      title: `${who} unmasked in your chat`,
      body: "If you unmask too, you'll match and see each other's profiles.",
      url: `/masquerade/${s.id}`,
      tag: `unmask-${s.id}`,
    });
    return ok;
  }

  // You waved at someone: tell them (or, if you both waved, that your chat is open)
  if (b.kind === "wave" && b.personId) {
    const { data: w } = await db.from("waves").select("created_at, session_id").eq("from_id", uid).eq("to_id", b.personId).maybeSingle();
    if (!w || Date.now() - new Date(w.created_at as string).getTime() > RECENT_MS) return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    const icon = (me?.photos as string[] | null)?.[0] ?? null;
    if (w.session_id) {
      await pushToUsers([b.personId], {
        title: `${firstName(me?.display_name)} waved back`,
        body: "You both waved, so your chat is now open.",
        url: `/masquerade/${w.session_id}`,
        tag: `masked-${w.session_id}`,
        icon,
      });
    } else {
      await pushToUsers([b.personId], {
        title: `${firstName(me?.display_name)} waved at you`,
        body: "Wave back to open a free chat.",
        url: "/home?views=1",
        tag: `wave-${uid}`,
        icon,
      });
    }
    return ok;
  }

  // Someone broke the ice with you (masked: they only see your mask name… and you see theirs)
  if (b.kind === "icebreaker" && b.iceId) {
    const { data: i } = await db.from("ice_breaks").select("id, from_user, to_user, alias, kind, game, status, created_at").eq("id", b.iceId).maybeSingle();
    if (!i || i.from_user !== uid || i.status !== "pending" || Date.now() - new Date(i.created_at as string).getTime() > RECENT_MS) return ok;
    const what =
      i.kind === "card" ? "replied to one of your cards" : i.kind === "this" ? "asked you a This or That" : i.kind === "voice" ? "sent you a voice hello" : "challenged you to a game";
    await pushToUsers([i.to_user as string], {
      title: `${i.alias} broke the ice 🧊`,
      body: `Someone masked ${what}. Answer and your chat opens.`,
      url: "/matches?f=ice",
      tag: `ice-${i.id}`,
    });
    return ok;
  }

  // They answered your icebreaker: your masked chat is open
  if (b.kind === "icebreaker_answer" && b.iceId) {
    const { data: i } = await db.from("ice_breaks").select("id, from_user, to_user, session_id, status, answered_at").eq("id", b.iceId).maybeSingle();
    if (!i || i.to_user !== uid || i.status !== "answered" || !i.session_id || Date.now() - new Date(i.answered_at as string).getTime() > RECENT_MS) return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    await pushToUsers([i.from_user as string], {
      title: `${firstName(me?.display_name as string | null)} answered your icebreaker`,
      body: "Your masked chat is open. Say hi!",
      url: `/masquerade/${i.session_id}`,
      tag: `masked-${i.session_id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  // Play paired you with someone who was waiting: tell them the game is on
  if (b.kind === "play_match" && b.gameId) {
    const { data: g } = await db.from("games").select("id, kind, player_a, player_b, play, created_at").eq("id", b.gameId).maybeSingle();
    if (!g || !g.play || g.player_b !== uid || Date.now() - new Date(g.created_at as string).getTime() > RECENT_MS) return ok;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", uid).single();
    const title = ({ whot: "Whot", ayo: "Ayo", ludo: "Ludo", snakes: "Snakes & Ladders", xo: "X & O", lastcard: "Last Card" } as Record<string, string>)[g.kind as string] ?? "a game";
    await pushToUsers([g.player_a as string], {
      title: `${title} with ${firstName(me?.display_name as string | null)} has started`,
      body: "It's your move.",
      url: `/home?game=${g.id}`,
      tag: `play-${g.id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  // Someone found you on Meet and opened a masked chat
  if (b.kind === "masked_start" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, alias_a, source, status, started_at").eq("id", b.sessionId).maybeSingle();
    if (!s || s.user_a !== uid || s.source !== "explore" || s.status !== "active" || Date.now() - new Date(s.started_at as string).getTime() > RECENT_MS) return ok;
    await pushToUsers([s.user_b as string], {
      title: `New masked chat from ${s.alias_a}`,
      body: "They found you on Meet. You'll see who they are if you both unmask.",
      url: `/masquerade/${s.id}`,
      tag: `masked-${s.id}`,
    });
    return ok;
  }

  // A message in a masked chat (sent only if they're not in the app right now)
  if (b.kind === "masked_message" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, alias_a, alias_b, status, source, waved, pact_id, meet_id").eq("id", b.sessionId).maybeSingle();
    if (!s || (s.user_a !== uid && s.user_b !== uid) || s.status !== "active") return ok;
    const { data: msg } = await db
      .from("masquerade_messages")
      .select("kind, body, created_at")
      .eq("session_id", s.id)
      .eq("sender_id", uid)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!msg || Date.now() - new Date(msg.created_at as string).getTime() > RECENT_MS) return ok;
    await pushToUsers(
      [(s.user_a === uid ? s.user_b : s.user_a) as string],
      { title: await senderLabel(db, s, uid, (s.user_a === uid ? s.alias_a : s.alias_b) as string), body: preview(msg.kind === "sticker" || msg.kind === "scribble" || msg.kind === "draw" ? (msg.kind as string) : "text", msg.body as string), url: `/masquerade/${s.id}`, tag: `masked-${s.id}` },
      { skipIfActive: true },
    );
    return ok;
  }

  // Someone paid to reopen a past masked pair: tell the other person
  if (b.kind === "masquerade_reopen" && b.sessionId) {
    const { data: s } = await db.from("masquerade_sessions").select("id, user_a, user_b, alias_a, alias_b, reopened_by, status").eq("id", b.sessionId).maybeSingle();
    if (!s || s.reopened_by !== uid || s.status !== "active") return ok;
    const other = s.user_a === uid ? s.user_b : s.user_a;
    const alias = s.user_a === uid ? s.alias_a : s.alias_b;
    await pushToUsers([other as string], {
      title: `${alias} reopened your masked chat`,
      body: "You can carry on where you left off. You both stay masked.",
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
      title: `${s.alias_b} replied to your Meet post`,
      body: m?.kind === "game" && title ? `They want to play ${title}. You both stay masked.` : "They started a masked chat from your post.",
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
    const title =
      ({ truths: "Two Truths & a Lie", tot: "This or That", c4: "Connect 4", words: "Word Hunt", whot: "Whot", checkers: "Checkers", chess: "Chess", ayo: "Ayo", bomb: "Bombshell", gems: "Gem Clash", ludo: "Ludo", snakes: "Snakes & Ladders", xo: "X & O", lastcard: "Last Card" } as Record<string, string>)[g.kind as string] ?? "a game";
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
      // A Play game isn't in a chat: the app opens it wherever you are
      url = g.match_id ? `/matches/${g.match_id}` : `/home?game=${g.id}`;
    }
    await pushToUsers([g.player_b as string], {
      title: `${who} invited you to play ${title}`,
      body: "The invite lasts 30 seconds.",
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
      // During an event everyone is in the app, so always send it: the phone skips it
      // only if they're looking at this very chat (see sw.js)
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
      title: `You matched with ${firstName(me?.display_name)}`,
      body: `You both kept your chat from ${e?.title ?? "the event"}.`,
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
      title: `You matched with ${firstName(me?.display_name)}`,
      body: "You both kept your chat from the Feed.",
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
      title: `${firstName(me?.display_name)} sent you ${gift ? `a ${gift.name.toLowerCase()}` : "a gift"}`,
      body: "For your answer on the Feed. You can reply for free.",
      url: "/feed",
      tag: `feed-gift-${g.id}`,
      icon: (me?.photos as string[] | null)?.[0] ?? null,
    });
    return ok;
  }

  return ok;
}
