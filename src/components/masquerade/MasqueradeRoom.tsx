"use client";

import { ChatBackdrop } from "@/components/chat/ChatBackdrop";
import { ChatBgSheet } from "@/components/chat/ChatBgSheet";
import { chatBgInfo, isChatBg, loadChatBg, saveChatBg, saveMyDefaultBg, type ChatBgId } from "@/lib/chatBackgrounds";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag, Gamepad2, Gift, Handshake, LogOut, MoreVertical, Dices, Palette, RotateCcw, ShieldCheck, Timer, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftSheet, keysError } from "@/components/keys/GiftSheet";
import { reportError } from "@/lib/reportError";
import { Photo } from "@/components/ui/Photo";
import { useWallet } from "@/components/keys/useWallet";
import { EXTEND_COST } from "@/lib/keys";
import { notify } from "@/lib/pushClient";
import { connectionsLabel, replyLabel } from "@/lib/hourly";
import { usePrices } from "@/components/keys/usePrices";
import { createClient } from "@/lib/supabase/client";
import { distanceLabel, GENDERS, intentLabel, MASQUERADE_MINUTES, spiceLabel } from "@/lib/constants";
import type { ChatMessage, MasqueradeState } from "@/lib/types";
import type { StickerPick } from "@/components/stickers/StickerSheet";
import type { Drawing } from "@/lib/scribble";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";
import { YouBoth } from "@/components/matches/YouBoth";
import { ExploreProfileSheet } from "@/components/explore/ExploreProfileSheet";
import { MaskedVoiceSheet } from "@/components/chat/MaskedVoiceSheet";
import { usePaidChatPeople, type PaidChatPerson } from "./usePaidChatPeople";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Chilis } from "@/components/ui/Spice";
import { TimerRing } from "./TimerRing";
import { InterestTag } from "@/components/profile/InterestPicker";
import { DecisionSheet } from "./DecisionSheet";
import { Outcome } from "./Outcome";
import { ReportSheet } from "./ReportSheet";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";
import { useGameHost } from "@/components/games/GameHost";
import { gameInfo } from "@/lib/games";
import { GoldStar } from "@/components/pacts/PactReveal";

const TOTAL = MASQUERADE_MINUTES * 60;

export function MasqueradeRoom({
  initial,
  initialMessages,
  demo,
  eventId = null,
  pact = null,
  initialPaid,
}: {
  initial: MasqueradeState;
  initialMessages: ChatMessage[];
  demo?: { remaining: number; hideExtend?: boolean };
  /** Set when this chat is a round of a Masquerade Night */
  eventId?: string | null;
  /** Set when this chat is a pact match: it carries a gold star */
  pact?: string | null;
  /** Who's who in chats started from Meet, fetched with the page */
  initialPaid?: Record<string, PaidChatPerson>;
}) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initial);
  // A chat you paid to start on Meet (or you both waved): you saw their name and main photo there, so they show.
  // Loaded with the page, so the chat opens in the right layout straight away.
  const paidPeople = usePaidChatPeople(!!demo, initialPaid);
  const paidChat = paidPeople[state.id];
  // You paid: their name and blurred photo. They paid: they can see your name, you can't see theirs.
  const known = paidChat?.started_by_me === false ? undefined : paidChat;
  const theyPaid = paidChat?.started_by_me === false;
  const theirName = known?.name || state.them.alias;
  // Chats from a wave need no explaining: you both chose each other
  const whoSees = paidChat?.waved ? null : known?.name ? (
    <>
      You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. You found {known.name} on Meet, so you can see their name and photo.
    </>
  ) : theyPaid ? (
    <>
      You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. They found you on Meet, so they know who you are. Their name and photos stay hidden until you both unmask.
    </>
  ) : (
    <>
      You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. Names and photos stay hidden until you both unmask.
    </>
  );
  const [messages, setMessages] = useState(initialMessages);
  const [profileOpen, setProfileOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  // What you know about them so far (connections, reply speed, spice, interests): tap their name to show
  const [about, setAbout] = useState(false);
  // Notes in the chat are saved with mask names. Show "You" for you, and their real name when you know it.
  const shownMessages = useMemo(() => {
    const mine = state.me.alias;
    const theirs = state.them.alias;
    // The automatic icebreaker that used to start every chat: hidden (ones you ask for from + still show)
    const start = new Date(state.started_at).getTime();
    return messages
      .filter((m) => !(m.kind === "icebreaker" && !m.sender_id && new Date(m.created_at).getTime() - start < 15_000))
      .map((m) => {
      if (m.kind !== "system" || !m.body) return m;
      let body = m.body;
      if (body.startsWith(`${mine} unmasked`)) body = `You unmasked. If ${theirName} unmasks too, you're connected.`;
      else if (body.startsWith(`${mine} found you on Meet`)) body = `You started this chat from Meet.`;
      else if (body.startsWith(`${mine} `)) body = `You ${body.slice(mine.length + 1)}`;
      else if (theirName !== theirs && body.includes(theirs)) body = body.split(theirs).join(theirName);
      return body === m.body ? m : { ...m, body };
    });
  }, [messages, state.me.alias, state.them.alias, state.started_at, theirName]);
  // You paid to start this chat: your Keys come back if they never reply in 48 hours
  const theyReplied = messages.some((m) => m.sender_id && m.sender_id !== state.me.id);
  const keysWord = (n?: number) => `${n ?? ""} ${n === 1 ? "Key" : "Keys"}`.trim();
  const refundNote = !known?.started_by_me || theyReplied
    ? null
    : known.refunded
      ? `They didn't reply in 48 hours, so your ${keysWord(known.paid_keys)} came back.`
      : known.refund_at
        ? `No reply by ${new Date(known.refund_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}? Your ${keysWord(known.paid_keys)} ${known.paid_keys === 1 ? "comes" : "come"} back.`
        : null;
  const [menu, setMenu] = useState(false);
  // The chat background: the one either of you picked for this chat (both see it), else your own default
  const [sharedBg, setSharedBg] = useState<string | null>(null);
  const [myBg, setMyBg] = useState<ChatBgId>("classic");
  const [bgOpen, setBgOpen] = useState(false);
  useEffect(() => setMyBg(loadChatBg(`s-${initial.id}`)), [initial.id]);
  const bg: ChatBgId = isChatBg(sharedBg) ? sharedBg : myBg;
  const [reporting, setReporting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [chatNote, setChatNote] = useState<string | null>(null);
  useEffect(() => {
    if (!chatNote) return;
    const t = setTimeout(() => setChatNote(null), 2500);
    return () => clearTimeout(t);
  }, [chatNote]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [keysNote, setKeysNote] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [askUnmask, setAskUnmask] = useState(false);
  const [unmasked, setUnmasked] = useState(initial.me.vote === true);
  const [voteError, setVoteError] = useState<string | null>(null);
  const prices = usePrices();
  const { wallet, refresh: refreshWallet } = useWallet(demo ? null : initial.me.id);

  async function extend() {
    setExtending(true);
    setKeysNote(null);
    const { data, error } = await supabase.rpc("extend_masquerade", { p_session: initial.id });
    setExtending(false);
    if (error) return setKeysNote(keysError(error.message));
    if (data) setState((s) => ({ ...s, ends_at: data as string }));
    refreshWallet();
  }
  // Keep our clock in step with the server's so both timers match
  const offset = useRef(new Date(initial.server_now).getTime() - Date.now());
  const remainingNow = useCallback(
    () =>
      demo
        ? demo.remaining
        : state.reopened
          ? Infinity // open until you both decide
          : (new Date(state.ends_at).getTime() - (Date.now() + offset.current)) / 1000,
    [state.ends_at, state.reopened, demo],
  );
  const [remaining, setRemaining] = useState(remainingNow);

  // Each refresh gets a number, so an older answer arriving late can't undo a newer one (like your unmask)
  const ask = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++ask.current;
    const { data } = await supabase.rpc("get_masquerade", { p_session: initial.id });
    if (data && n === ask.current) setState(data as MasqueradeState);
  }, [supabase, initial.id]);

  // Tick the timer
  useEffect(() => {
    const t = setInterval(() => setRemaining(remainingNow()), 500);
    return () => clearInterval(t);
  }, [remainingNow]);

  // Being in the chat (and anything that arrives or you send while it's open) counts as read
  useEffect(() => {
    if (demo) return;
    supabase.rpc("mark_masked_read", { p_session: initial.id }).then(() => refreshMenuBadges());
  }, [supabase, initial.id, messages.length, demo]);

  // Live messages and status changes
  useEffect(() => {
    if (demo) return;
    const channel = supabase
      .channel(`room-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "masquerade_messages", filter: `session_id=eq.${initial.id}` },
        (p) => {
          const m = p.new as ChatMessage;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        },
      )
      // Reactions and edits
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "masquerade_messages", filter: `session_id=eq.${initial.id}` },
        (p) => {
          const m = p.new as ChatMessage;
          setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "masquerade_sessions", filter: `id=eq.${initial.id}` },
        (p) => {
          // A new chat background from either of you
          const next = (p.new as { chat_bg?: string | null }).chat_bg;
          if (next !== undefined) setSharedBg(next);
          void refresh();
        },
      )
      .subscribe();
    // The background already picked for this chat (nothing before update 83 runs)
    void supabase
      .from("masquerade_sessions")
      .select("chat_bg")
      .eq("id", initial.id)
      .maybeSingle()
      .then(({ data }) => setSharedBg(((data as { chat_bg?: string | null } | null)?.chat_bg ?? null)));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, refresh, demo]);

  // Safety net: re-check every few seconds once the chat is over (and slowly during it)
  const timeUp = remaining <= 0;
  useEffect(() => {
    if (demo || state.status !== "active") return;
    // Changes arrive live; this only keeps the timer and "online" fresh, so every 20s is plenty
    // Not while the app is in the background; back in it, check straight away
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), timeUp ? 3000 : 20000);
    const onShow = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh, timeUp, state.status, demo]);

  async function send(text: string) {
    const reply = replyTo?.id && replyTo.id > 0 ? replyTo.id : null;
    const temp: ChatMessage = { id: -Date.now(), sender_id: state.me.id, kind: "text", body: text, created_at: new Date().toISOString(), reply_to: reply, pending: true };
    setMessages((l) => [...l, temp]);
    setReplyTo(null);
    const { data, error } = await supabase
      .from("masquerade_messages")
      .insert({ session_id: state.id, sender_id: state.me.id, body: text, reply_to: reply })
      .select("id, sender_id, kind, body, created_at, reply_to")
      .single();
    // They're not in the app? Let them know (the server checks)
    if (!error && data) notify({ kind: "masked_message", sessionId: state.id });
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      if (error || !data) return without;
      return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage];
    });
  }

  async function sendSticker(st: StickerPick) {
    if (demo) return;
    const reply = replyTo?.id && replyTo.id > 0 ? replyTo.id : null;
    const meta = { pose: st.pose, color: st.color };
    const temp: ChatMessage = { id: -Date.now(), sender_id: state.me.id, kind: "sticker", body: st.caption, media_meta: meta, created_at: new Date().toISOString(), reply_to: reply, pending: true };
    setMessages((l) => [...l, temp]);
    setReplyTo(null);
    const { data, error } = await supabase
      .from("masquerade_messages")
      .insert({ session_id: state.id, sender_id: state.me.id, kind: "sticker", body: st.caption, media_meta: meta, reply_to: reply })
      .select("*")
      .single();
    if (!error && data) notify({ kind: "masked_message", sessionId: state.id });
    if (error) setChatNote("Sticker not sent. Check your connection.");
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      if (error || !data) return without;
      return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage];
    });
  }

  // A scribble costs Keys, so the server sends it (and takes them)
  async function sendScribble(d: Drawing): Promise<string | null> {
    if (demo) return null;
    const { data, error } = await supabase.rpc("send_scribble", { p_drawing: d, p_session: state.id, p_reply: replyTo?.id && replyTo.id > 0 ? replyTo.id : null });
    if (error) return error.message.includes("send_scribble") ? "Scribbles are coming soon." : error.message.includes("too big") || error.message.includes("Draw") ? error.message : keysError(error.message);
    const m = data as ChatMessage;
    setReplyTo(null);
    setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    notify({ kind: "masked_message", sessionId: state.id });
    refreshWallet();
    return null;
  }

  // React (or take yours back): shows straight away, undone if it doesn't save
  async function react(m: ChatMessage, emoji: string) {
    const me = state.me.id;
    const before = m.reactions ?? {};
    const next = { ...before };
    if (!emoji || before[me] === emoji) delete next[me];
    else next[me] = emoji;
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: next } : x)));
    if (demo) return;
    const { data, error } = await supabase.rpc("react_message", { p_message: m.id, p_emoji: emoji === before[me] ? "" : emoji, p_masked: true });
    if (error) {
      setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: before } : x)));
      setChatNote("Couldn't react. Check your connection.");
    } else if (data) setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: data as Record<string, string> } : x)));
  }

  async function saveEdit(m: ChatMessage, text: string) {
    setEditing(null);
    const before = { body: m.body, edited_at: m.edited_at ?? null };
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, body: text, edited_at: new Date().toISOString() } : x)));
    if (demo) return;
    const { error } = await supabase.rpc("edit_message", { p_message: m.id, p_body: text, p_masked: true });
    if (error) {
      setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, ...before } : x)));
      setChatNote(error.message.includes("15 minutes") ? "You can only edit a message in the first 15 minutes." : "Couldn't save your edit. Check your connection.");
    }
  }

  async function vote(unmask: boolean) {
    setVoting(true);
    setAskUnmask(false);
    setVoteError(null);
    ask.current++;
    setState((s) => ({ ...s, me: { ...s.me, vote: unmask } }));
    const { error } = await supabase.rpc("vote_unmask", { p_session: state.id, p_unmask: unmask });
    if (error) {
      setVoting(false);
      // Say why (and log it), instead of always blaming the connection
      reportError(new Error(error.message), "unmask");
      const timer = /timer ends/i.test(error.message);
      setVoteError(
        timer
          ? "More time was added to this chat. You can unmask when the timer ends."
          : /fetch|network/i.test(error.message)
            ? "That didn't go through. Check your connection and try again."
            : `That didn't go through: ${error.message}`,
      );
      setState((s) => ({ ...s, me: { ...s.me, vote: null } }));
      // Back open, so the reason shows
      setAskUnmask(true);
      // Get the right end time from the server
      if (timer) void refresh();
      return;
    }
    if (unmask) setUnmasked(true);
    const n = ++ask.current;
    const { data } = await supabase.rpc("get_masquerade", { p_session: initial.id });
    if (data && n === ask.current) {
      setState(data as MasqueradeState);
      // You were the second to unmask: tell the other person they clicked. The first: tell them you unmasked
      if (unmask && (data as MasqueradeState).status === "matched") notify({ kind: "masquerade_match", sessionId: initial.id });
      else if (unmask && (data as MasqueradeState).status !== "ended") notify({ kind: "masquerade_unmask", sessionId: initial.id });
    }
    setVoting(false);
  }

  async function leave() {
    setMenu(false);
    if (
      !confirm(
        state.meet
          ? `Let go of ${theirName}? The chat closes for both of you.`
          : state.hourly
            ? `Let go of ${theirName}? The chat closes for both of you. You'll get someone new soon.`
            : "Leave this masquerade? The chat will be deleted.",
      )
    )
      return;
    await supabase.rpc("vote_unmask", { p_session: state.id, p_unmask: false });
    router.replace(state.meet ? "/meet" : "/home");
  }

  async function report(reason: string) {
    await supabase.rpc("report_masquerade", { p_session: state.id, p_reason: reason });
    setReporting(false);
    await refresh();
  }

  async function nextQuestion() {
    await supabase.rpc("next_icebreaker", { p_session: state.id });
  }

  async function reopen() {
    setReopening(true);
    setKeysNote(null);
    const { error } = await supabase.rpc("reopen_masquerade", { p_session: state.id });
    setReopening(false);
    if (error) return setKeysNote(keysError(error.message));
    notify({ kind: "masquerade_reopen", sessionId: state.id });
    refreshWallet();
    await refresh();
  }

  // Text waiting in the message box
  const [hintDraft, setHintDraft] = useState<{ text: string; key: number } | null>(null);
  // An opener you picked on their profile before the chat opened
  useEffect(() => {
    try {
      const k = `dp_say_${initial.id}`;
      const say = sessionStorage.getItem(k);
      if (say) {
        sessionStorage.removeItem(k);
        setHintDraft({ text: say, key: Date.now() });
      }
    } catch {
      /* private mode */
    }
  }, [initial.id]);

  // Games: every masked chat, while it's open.
  // In a game meet the first game comes from the line, so the game button waits for it.
  const meet = state.meet ?? null;
  const lastFromThem = [...messages].reverse().find((m) => m.sender_id && m.sender_id !== state.me.id && m.kind === "text");
  const games = useGameHost({
    sessionId: state.id,
    names: { me: state.me.alias, them: theirName },
    masked: true,
    disabled: state.status !== "active" || remaining <= 0,
    noLauncher: !!meet?.turn_pending,
    offline: !!demo,
    peek: lastFromThem?.body ?? null,
    unmask: state.hourly ? { onUnmask: () => setAskUnmask(true), done: state.me.vote === true || unmasked } : null,
  });

  // Once you've unmasked it stays that way on screen, whatever arrives late from the server
  const iUnmasked = state.me.vote === true || unmasked;

  if (state.status !== "active" && state.status !== "lapsed") return <Outcome state={state} eventId={eventId} />;
  // Open-ended chats (from Meet, or reopened) live in Chats
  const back = meet ? "/meet" : state.reopened ? "/matches" : "/home";

  const them = state.them;
  const gender = GENDERS.find((g) => g.value === them.gender)?.label;
  const lapsed = state.status === "lapsed";
  const chatting = !lapsed && !timeUp;
  const total = meet
    ? Math.max(60, (new Date(state.ends_at).getTime() - new Date(state.started_at).getTime()) / 1000)
    : state.hourly
      ? 3600
      : TOTAL;

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-20 flex h-dvh overflow-hidden lg:static">
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-cream lg:max-w-none lg:flex-1">
      {/* Header */}
      <header className="z-10 border-b border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          {state.hourly && (
            <Link href={back} className="-ml-2 grid h-10 w-8 shrink-0 place-items-center rounded-full hover:bg-ink/5" aria-label={meet ? "Back to Meet" : "Back home"}>
              <ArrowLeft size={22} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => (known?.id ? setProfileOpen(true) : setAbout((a) => !a))}
            aria-label={known?.id ? `See ${theirName}'s profile` : about ? "Hide what you know about them" : "See what you know about them"}
            aria-expanded={known?.id ? undefined : about}
            className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.98]"
          >
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white">
            {known?.photo ? (
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <Photo src={known.photo} id={known.id} gender={state.them.gender} className="h-full w-full object-cover" />
              </span>
            ) : (
              <MaskIcon className="w-7" eyes="#1c1828" />
            )}
            <span
              className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface ${them.online ? "bg-mint" : "bg-[#b9b3c4]"}`}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[16px] font-semibold">
              <span className="truncate">{theirName}</span>
              {pact && <GoldStar size={18} />}
            </p>
            {pact && <p className="truncate text-[12px] font-semibold text-[#a26b00]">{pact} match</p>}
            <p className="truncate text-[13px] text-muted">
              <span className={them.online ? "font-semibold text-mint" : undefined}>{presenceText(them.online, them.seen_minutes)}</span>
              {[them.age ? String(them.age) : null, gender, (them.same_place ? "Near you" : them.place) ?? distanceLabel(them.distance_km) ?? intentLabel(state.intent)]
                .filter(Boolean)
                .map((t) => ` · ${t}`)
                .join("")}
            </p>
          </div>
          </button>
          {lapsed ? (
            <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-muted">{meet ? "Meet over" : "Hour over"}</span>
          ) : state.reopened ? (
            <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 text-[12px] font-semibold text-mint">{state.play ? "Game chat" : state.explore ? "Open chat" : "Reopened"}</span>
          ) : (
            <TimerRing remaining={remaining} total={total} />
          )}
          {/* Unmask lives in the header now (it used to take a whole row) */}
          {state.hourly && !lapsed && !iUnmasked && (
            <button
              type="button"
              onClick={() => setAskUnmask(true)}
              disabled={voting}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-full bg-brand text-[13px] font-semibold text-white shadow-[0_6px_16px_-6px_rgb(91_63_217/0.7)] transition active:scale-95 disabled:opacity-60 sm:w-auto sm:px-3.5"
              aria-label="Unmask"
              title="Unmask"
            >
              <MaskIcon className="w-6 sm:w-5" eyes="#5b3fd9" /> <span className="hidden sm:inline">Unmask</span>
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
              {menu ? <X size={20} /> : <MoreVertical size={20} />}
            </button>
            {menu && (
              <div className="absolute top-11 right-0 z-20 w-52 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-fade-up">
                <button
                  onClick={() => {
                    setMenu(false);
                    setBgOpen(true);
                  }}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left text-[15px] hover:bg-cream"
                >
                  <Palette size={18} /> Chat background
                </button>
                <button onClick={leave} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-cream">
                  <LogOut size={18} /> {state.hourly ? "Let go" : "Leave chat"}
                </button>
                <button onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left text-[15px] text-chili hover:bg-chili-soft">
                  <Flag size={18} /> Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* What we know so far (shown in the side panel on computers). Not needed when you
            can open their profile instead (chats you started from Meet, or where you both waved). */}
        {!known?.id && about && (
        <div className="flex animate-fade-up items-center gap-2 overflow-x-auto px-4 pb-3 no-scrollbar lg:hidden">
          {them.age ? <Tag strong>{them.age} years old</Tag> : null}
          <Tag strong>{connectionsLabel(them.connections)}</Tag>
          <Tag>{replyLabel(them.reply_seconds)}</Tag>
          {state.intent !== "friends" && (
            <>
              <Tag>
                You <Chilis level={state.me.spice} />
              </Tag>
              <Tag>
                Them <Chilis level={them.spice} />
              </Tag>
              <Tag strong>Questions: {spiceLabel(state.spice_level)}</Tag>
            </>
          )}
          {[...(them.shared_interests ?? []), ...them.interests.filter((i) => !(them.shared_interests ?? []).includes(i))]
            .slice(0, 8)
            .map((i) => (
              <InterestTag key={i} name={i} highlight={(them.shared_interests ?? []).includes(i)} />
          ))}
        </div>
        )}
      </header>

      {/* After someone chooses to unmask: a small note (the button itself is in the header) */}
      {state.hourly && !lapsed && (iUnmasked || them.has_voted) && (
        <div className="flex items-center gap-2.5 border-b border-line bg-brand-soft/60 px-4 py-2">
          <Handshake size={16} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            {iUnmasked ? (
              <>
                <span className="block font-semibold text-ink">You chose to unmask.</span>
                <span className="block text-muted">If {theirName} does too, you&apos;re connected.</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">Feeling the vibe?</span>{" "}
                <span className="text-muted">{them.has_voted ? `${theirName} has made a choice.` : "Unmask whenever you're ready."}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col" data-bg={bg !== "classic" ? "" : undefined} data-bg-dark={chatBgInfo(bg).dark ? "" : undefined}>
      <ChatBackdrop id={bg} />
      <div data-chat-scroll className="relative flex-1 overflow-y-auto overscroll-contain">
        {whoSees && (
          <p className={clsx("text-center text-[12px] leading-relaxed text-muted", bg === "classic" ? "px-6 pt-3" : "mx-auto mt-3 w-fit max-w-[90%] rounded-2xl bg-surface/90 px-3 py-1.5")}>
            {whoSees}
          </p>
        )}
        {refundNote && (
          <p className="mx-auto mt-2 flex w-fit max-w-[90%] items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 text-center text-[12px] font-medium text-ink-soft">
            <ShieldCheck size={14} className="shrink-0 text-mint" /> {refundNote}
          </p>
        )}
        {/* What you have in common (on computers it's in the side panel) */}
        {!demo && (
          <div className="mx-4 mt-3 lg:hidden">
            <YouBoth session={state.id} />
          </div>
        )}
        <MessageList
          messages={shownMessages}
          myId={state.me.id}
          nameOf={(id) => (id === state.me.id ? "You" : theirName)}
          genderOf={(id) => (id === state.me.id ? null : state.them.gender)}
          onReply={setReplyTo}
          onReact={react}
          onEdit={
            chatting
              ? (m) => {
                  setReplyTo(null);
                  setEditing(m);
                }
              : undefined
          }
          onGameAgain={chatting ? games.rematch : undefined}
        />
      </div>
      </div>

      {chatting && !state.hourly && remaining <= 90 && !demo?.hideExtend && (
        <div className="flex animate-fade-up items-center gap-3 border-t border-line bg-mint-soft/60 px-4 py-2.5">
          <Timer size={18} className="shrink-0 text-mint" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="font-semibold text-ink">Running out of time?</span>{" "}
            <span className="text-muted">Add 2 minutes for both of you.</span>
          </p>
          <button
            type="button"
            onClick={extend}
            disabled={extending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-mint px-3.5 text-[13px] font-bold text-white transition active:scale-95 disabled:opacity-60"
          >
            {extending ? <Spinner className="h-4 w-4" /> : <KeyCoin size={18} />} +2 min · {EXTEND_COST}
          </button>
        </div>
      )}
      {chatNote && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm animate-fade-up rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift">{chatNote}</div>
      )}
      {keysNote && (
        <div className="flex items-center gap-3 border-t border-line bg-gold-soft px-4 py-2.5 text-[13px]">
          <p className="flex-1 font-medium text-[#8a5a00]">{keysNote}</p>
          <Link href="/wallet" target="_blank" className="shrink-0 font-semibold text-brand">Get Keys</Link>
          <button onClick={() => setKeysNote(null)} aria-label="Dismiss" className="text-muted"><X size={16} /></button>
        </div>
      )}

      {lapsed && (
        <div className="animate-fade-up border-t border-line bg-surface px-5 pt-4 pb-safe">
          <p className="text-center text-[15px] font-semibold">{meet ? "The meet ended" : "The hour ran out"} before you both decided</p>
          <p className="mx-auto mt-1 max-w-sm text-center text-[13px] leading-snug text-muted">
            {iUnmasked
              ? `You unmasked. If ${theirName} unmasks too, you're connected.`
              : `Unmask now, and if ${theirName} does too, you're connected. Or reopen the chat to keep talking.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 pb-2">
            {!iUnmasked ? (
              <button
                type="button"
                onClick={() => setAskUnmask(true)}
                disabled={voting}
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-brand text-[15px] font-semibold text-white disabled:opacity-60"
              >
                <Handshake size={18} /> Unmask
              </button>
            ) : (
              <span className="inline-flex h-12 items-center justify-center rounded-2xl bg-mint-soft text-[14px] font-semibold text-mint">Unmasked ✓</span>
            )}
            <button
              type="button"
              onClick={reopen}
              disabled={reopening}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-gold/50 bg-gold-soft text-[15px] font-semibold text-[#8a5a00] disabled:opacity-60"
            >
              {reopening ? <Spinner className="h-4 w-4" /> : <RotateCcw size={17} />} Reopen · <KeyCoin size={16} /> {prices.reopen_cost}
            </button>
          </div>
          <button type="button" onClick={leave} className="mx-auto mb-2 block text-[13px] font-semibold text-muted hover:text-chili">
            Let go
          </button>
        </div>
      )}

      {meet && chatting && !(games.game && (games.game.status === "invited" || games.game.status === "active")) && <MeetLine meet={meet} them={theirName} />}
      {chatting && games.banner}
      {chatting ? (
        <Composer
          saveKey={`s-${state.id}`}
          draft={hintDraft}
          onSend={send}
          onSendSticker={sendSticker}
          onSendScribble={sendScribble}
          editing={editing}
          onEdit={saveEdit}
          onCancelEdit={() => setEditing(null)}
          // Masked voice notes: disguised on the phone
          onVoiceTap={() => setVoiceOpen(true)}
          placeholder={state.hourly ? "Message" : undefined}
          replyTo={replyTo}
          replyName={replyTo ? (replyTo.sender_id === state.me.id ? "yourself" : replyTo.sender_id ? theirName : replyTo.kind === "game" ? "the game" : "the icebreaker") : undefined}
          onCancelReply={() => setReplyTo(null)}
          plusDot={games.live}
          actions={[
            ...(games.canPlay
              ? [{ key: "game", label: games.live ? "Back to game" : "Play a game", icon: <Gamepad2 size={24} strokeWidth={1.75} />, tone: "bg-brand-soft text-brand", onClick: games.play }]
              : []),
            // Icebreakers are written for dating, so friendship chats don't get them
            ...(state.intent !== "friends"
              ? [{ key: "ice", label: "Icebreaker", icon: <Dices size={24} strokeWidth={1.75} />, tone: "bg-gold-soft text-[#9a6a0c]", onClick: () => void nextQuestion() }]
              : []),
          ]}
          onGift={() => {
            refreshWallet();
            setGiftOpen(true);
          }}
        />
      ) : null}

      <Sheet
        open={askUnmask}
        onClose={() => setAskUnmask(false)}
        title={`Unmask to ${theirName}?`}
        subtitle={`If ${theirName} unmasks too, you'll both see each other's name and photos, and the chat moves to Chats.`}
        icon={<MaskIcon className="w-6" eyes="#5b3fd9" />}
        footer={
          <div className="space-y-2">
            {voteError && <p className="text-center text-[13px] font-medium text-chili">{voteError}</p>}
            <Button size="lg" onClick={() => vote(true)} loading={voting} loadingText="Unmasking…">
              Yes, unmask
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setAskUnmask(false)}>
              Not yet
            </Button>
          </div>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">You can&apos;t take it back once you&apos;ve unmasked. Until they unmask too, you both stay masked.</p>
      </Sheet>

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        balance={wallet?.balance ?? null}
        toName={theirName}
        onSend={async (g) => {
          const { error } = await supabase.rpc("send_gift", { p_gift: g.id, p_session: state.id });
          if (error) return keysError(error.message);
          refreshWallet();
          return null;
        }}
      />
      {timeUp && !state.hourly && <DecisionSheet state={state} voting={voting} onVote={vote} />}
      {reporting && <ReportSheet onClose={() => setReporting(false)} onReport={report} />}
      {games.overlay}
      {profileOpen && known?.id && <ExploreProfileSheet personId={known.id} onClose={() => setProfileOpen(false)} inChat />}
      <ChatBgSheet
        open={bgOpen}
        onClose={() => setBgOpen(false)}
        value={bg}
        onPick={(id, everywhere) => {
          setSharedBg(id);
          if (everywhere) saveMyDefaultBg(id);
          // For both of you (before update 83 runs, it's kept on this phone instead)
          void supabase.rpc("set_chat_bg", { p_bg: id, p_session: initial.id }).then(({ error }) => {
            if (error) saveChatBg(`s-${initial.id}`, id, false);
          });
        }}
        them={theirName}
      />
      <MaskedVoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        sessionId={state.id}
        onSent={(m) => setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))}
      />
    </div>

    {/* About them — side panel on computers */}
    <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface px-6 py-8 lg:flex">
      <div className="flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => known?.id && setProfileOpen(true)}
          disabled={!known?.id}
          aria-label={known?.id ? `See ${theirName}'s profile` : undefined}
          className="grid h-24 w-24 animate-float place-items-center overflow-hidden rounded-full bg-ink text-white shadow-lift"
        >
          {known?.photo ? (
            <Photo src={known.photo} id={known.id} gender={state.them.gender} className="h-full w-full object-cover" />
          ) : (
            <MaskIcon className="w-14" eyes="#1c1828" />
          )}
        </button>
        <p className="mt-4 font-display text-[26px] font-semibold">{theirName}</p>
        <p className="text-[14px] text-muted">
          {[them.age ? String(them.age) : null, gender, them.place ?? distanceLabel(them.distance_km)].filter(Boolean).join(" · ")}
        </p>
        {!lapsed && !state.reopened && (
          <>
            <div className="mt-5">
              <TimerRing remaining={remaining} total={total} />
            </div>
            <p className="mt-1 text-[12px] text-muted">{meet ? "left in this meet" : state.hourly ? "left this hour" : "until you both decide"}</p>
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-[15px] font-semibold">{them.connections ?? 0}</p>
          <p className="text-[11px] text-muted">{(them.connections ?? 0) === 1 ? "connection" : "connections"}</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-[13px] leading-tight font-semibold">{replyLabel(them.reply_seconds)}</p>
          <p className="text-[11px] text-muted">reply speed</p>
        </div>
      </div>

      <h3 className="mt-6 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Here for</h3>
      <p className="text-[15px] font-semibold">{intentLabel(state.intent)}</p>

      {state.intent !== "friends" && (
        <>
          <h3 className="mt-6 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Question spice</h3>
          <div className="flex flex-wrap gap-2">
            <Tag>
              You <Chilis level={state.me.spice} />
            </Tag>
            <Tag>
              Them <Chilis level={them.spice} />
            </Tag>
            <Tag strong>{spiceLabel(state.spice_level)}</Tag>
          </div>
        </>
      )}

      <h3 className="mt-6 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Into</h3>
      <div className="flex flex-wrap gap-2">
        {[...(them.shared_interests ?? []), ...them.interests.filter((i) => !(them.shared_interests ?? []).includes(i))].map((i) => (
          <InterestTag key={i} name={i} highlight={(them.shared_interests ?? []).includes(i)} />
        ))}
      </div>
      {!demo && (
        <div className="mt-6">
          <YouBoth session={state.id} tone="plain" />
        </div>
      )}

      {whoSees && (
        <p className="mt-auto rounded-2xl bg-cream p-4 text-[13px] leading-relaxed text-muted">
          {whoSees}
        </p>
      )}
    </aside>
        </div>
  );
}

function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold whitespace-nowrap " +
        (strong ? "bg-brand-soft text-brand-ink" : "bg-cream text-ink-soft")
      }
    >
      {children}
    </span>
  );
}

function formatList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " & " + items[items.length - 1];
}

/** Game meets: where you are in the line, or (on your own meet) where your game is happening */
function MeetLine({ meet, them }: { meet: NonNullable<MasqueradeState["meet"]>; them: string }) {
  if (meet.kind !== "game") return null;
  const title = gameInfo(meet.game ?? undefined).title;
  let text: React.ReactNode = null;
  let action: React.ReactNode = null;
  if (meet.mine && meet.live_chat) {
    text =
      meet.live_chat.status === "active" ? (
        <>
          <b className="text-white">You&apos;re playing {meet.live_chat.alias}.</b> {them} is waiting their turn.
        </>
      ) : (
        <>
          <b className="text-white">{meet.live_chat.alias}</b> is ready to play {title}.
        </>
      );
    action = (
      <Link href={`/masquerade/${meet.live_chat.id}`} className="h-9 shrink-0 rounded-full px-3.5 text-[13px] leading-9 font-bold gm-gold">
        Go
      </Link>
    );
  } else if (meet.mine && meet.turn_pending) {
    text = (
      <>
        <b className="text-white">{them} is in line</b> to play {title}. You&apos;ll get their challenge when it&apos;s their turn.
      </>
    );
  } else if (!meet.mine && meet.turn_pending) {
    text = (
      <>
        <b className="text-white">You&apos;re in line to play {title}.</b>{" "}
        {meet.ahead ? `${meet.ahead} ahead of you. ` : "You're next. "}Chat while you wait.
      </>
    );
  }
  if (!text) return null;
  return (
    <div className="flex animate-fade-up items-center gap-3 px-4 py-2.5 text-white" style={{ background: "linear-gradient(90deg, #2b1d73, #1a1240)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/12">
        <Gamepad2 size={17} className="text-gold" />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/80">{text}</p>
      {action}
    </div>
  );
}

function presenceText(online?: boolean, minutes?: number | null) {
  if (online) return "Online";
  if (minutes == null) return "Offline";
  if (minutes < 60) return `Active ${Math.max(1, minutes)}m ago`;
  if (minutes < 24 * 60) return `Active ${Math.floor(minutes / 60)}h ago`;
  return "Offline";
}
