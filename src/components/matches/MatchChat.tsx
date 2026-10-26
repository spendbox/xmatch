"use client";

import { ChatBackdrop } from "@/components/chat/ChatBackdrop";
import { ChatBgSheet } from "@/components/chat/ChatBgSheet";
import { chatBgInfo, isChatBg, loadChatBg, saveChatBg, saveMyDefaultBg, type ChatBgId } from "@/lib/chatBackgrounds";
import { notify } from "@/lib/pushClient";
import clsx from "clsx";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dices, Flag, Gamepad2, Palette, UserX, MoreVertical, Phone, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Intent, Profile } from "@/lib/types";
import { INTENT_ICONS, InterestIcon } from "@/components/ui/icons";
import { intentLabel } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { ReportSheet } from "@/components/masquerade/ReportSheet";
import { readMediaInfo, removeChatMedia, uploadChatMedia } from "@/lib/chatMedia";
import { useCall } from "@/components/calls/CallProvider";
import type { MediaKind } from "@/components/chat/Composer";
import { GiftSheet, keysError } from "@/components/keys/GiftSheet";
import { useWallet } from "@/components/keys/useWallet";
import { ProfileSheet } from "./ProfileSheet";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";
import { isOnline, lastSeenText, usePresence } from "@/lib/usePresence";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";
import { useGameHost } from "@/components/games/GameHost";
import { MaskedVoiceSheet } from "@/components/chat/MaskedVoiceSheet";
import type { VoiceStyle } from "@/lib/voiceDisguise";
import type { StickerPick } from "@/components/stickers/StickerSheet";
import type { Drawing } from "@/lib/scribble";

export function MatchChat({
  matchId,
  myId,
  other,
  initialMessages,
  shared = [],
  matchedAt,
  intent = "dating",
  slowCost = 10,
  source,
  chatBg,
}: {
  matchId: string;
  myId: string;
  other: Profile;
  initialMessages: ChatMessage[];
  shared?: string[];
  matchedAt?: string;
  intent?: Intent;
  /** Keys to clear a slow reveal straight away */
  slowCost?: number;
  /** "play": the chat was started after a Play game */
  source?: string | null;
  /** The background either of you picked for this chat */
  chatBg?: string | null;
}) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const { seen, now } = usePresence([other.id]);
  const theyreOnline = isOnline(seen[other.id], now);
  const activeNow = () => !!seen[other.id] && Date.now() - new Date(seen[other.id]).getTime() < 45_000;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [menu, setMenu] = useState(false);
  // The chat background: the one either of you picked for this chat (both see it), else your own default
  const [sharedBg, setSharedBg] = useState<string | null>(chatBg ?? null);
  const [myBg, setMyBg] = useState<ChatBgId>("classic");
  const [bgOpen, setBgOpen] = useState(false);
  const iSetBg = useRef<string | null>(null);
  useEffect(() => setMyBg(loadChatBg(`m-${matchId}`)), [matchId]);
  const bg: ChatBgId = isChatBg(sharedBg) ? sharedBg : myBg;
  const [showProfile, setShowProfile] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const { startCall, call } = useCall();
  const [giftOpen, setGiftOpen] = useState(false);
  const { wallet, refresh: refreshWallet } = useWallet(myId);
  const nameOf = (id: string | null) => (id === myId ? "You" : other.display_name ?? "Them");
  const lastFromThem = [...messages].reverse().find((m) => m.sender_id === other.id && m.kind === "text" && !m.deleted_at);
  const games = useGameHost({
    matchId,
    names: { me: "You", them: (other.display_name ?? "Them").split(" ")[0] },
    masked: false,
    peek: lastFromThem?.body ?? null,
  });

  // Opening the chat (and anything that arrives while it's open) counts as read
  useEffect(() => {
    supabase.rpc("mark_chat_read", { p_match: matchId }).then(() => refreshMenuBadges());
  }, [supabase, matchId, messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (p) => {
          const m = p.new as ChatMessage;
          setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
        },
      )
      // They changed the chat background: it changes here too
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, (p) => {
        const next = (p.new as { chat_bg?: string | null }).chat_bg ?? null;
        setSharedBg((cur) => {
          if (next !== cur && next !== iSetBg.current && isChatBg(next)) setToast(`${other.display_name?.split(" ")[0] ?? "They"} changed the chat background to ${chatBgInfo(next).name}`);
          return next;
        });
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (p) => {
          const m = p.new as ChatMessage;
          setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, matchId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Everything, so reactions and edits come back too (and nothing breaks before update 92 runs)
  const COLUMNS = "*";

  /** Shows the message straight away, then swaps in the saved one. */
  async function deliver(temp: ChatMessage, save: () => Promise<Record<string, unknown>>) {
    setMessages((l) => [...l, temp]);
    setReplyTo(null);
    try {
      const row = await save();
      const { data, error } = await supabase
        .from("messages")
        .insert({ match_id: matchId, sender_id: myId, reply_to: temp.reply_to ?? null, ...row })
        .select(COLUMNS)
        .single();
      if (error || !data) throw error;
      // Skip the push if they were using Dashpad seconds ago (they'll see it live)
      if (!activeNow()) notify({ kind: "message", matchId });
      setMessages((l) => {
        const without = l.filter((m) => m.id !== temp.id);
        return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage];
      });
    } catch (e) {
      setMessages((l) => l.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      setToast(e instanceof Error && e.message.includes("too big") ? e.message : "Message not sent. Check your connection.");
    }
  }

  function draft(kind: ChatMessage["kind"], body = "", extra: Partial<ChatMessage> = {}): ChatMessage {
    return { id: -Date.now(), sender_id: myId, kind, body, created_at: new Date().toISOString(), reply_to: replyTo?.id ?? null, pending: true, ...extra };
  }

  async function send(text: string) {
    await deliver(draft("text", text), async () => ({ kind: "text", body: text }));
  }

  async function sendSticker(st: StickerPick) {
    const meta = { pose: st.pose, color: st.color };
    await deliver(draft("sticker", st.caption, { media_meta: meta }), async () => ({ kind: "sticker", body: st.caption, media_meta: meta }));
  }

  // A scribble costs Keys, so the server sends it (and takes them)
  async function sendScribble(d: Drawing): Promise<string | null> {
    const { data, error } = await supabase.rpc("send_scribble", { p_drawing: d, p_match: matchId, p_reply: replyTo?.id && replyTo.id > 0 ? replyTo.id : null });
    if (error) return error.message.includes("send_scribble") ? "Scribbles are coming soon." : error.message.includes("too big") || error.message.includes("Draw") ? error.message : keysError(error.message);
    const m = data as ChatMessage;
    setReplyTo(null);
    setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    if (!activeNow()) notify({ kind: "message", matchId });
    refreshWallet();
    return null;
  }

  // React (or take yours back): shows straight away, undone if it doesn't save
  async function react(m: ChatMessage, emoji: string) {
    const before = m.reactions ?? {};
    const next = { ...before };
    if (!emoji || before[myId] === emoji) delete next[myId];
    else next[myId] = emoji;
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: next } : x)));
    const { data, error } = await supabase.rpc("react_message", { p_message: m.id, p_emoji: emoji === before[myId] ? "" : emoji });
    if (error) {
      setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: before } : x)));
      setToast(error.message.includes("react_message") ? "Reactions are coming soon." : "Couldn't react. Check your connection.");
    } else if (data) setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: data as Record<string, string> } : x)));
  }

  async function saveEdit(m: ChatMessage, text: string) {
    setEditing(null);
    const before = { body: m.body, edited_at: m.edited_at ?? null };
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, body: text, edited_at: new Date().toISOString() } : x)));
    const { error } = await supabase.rpc("edit_message", { p_message: m.id, p_body: text });
    if (error) {
      setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, ...before } : x)));
      setToast(error.message.includes("15 minutes") ? "You can only edit a message in the first 15 minutes." : "Couldn't save your edit. Check your connection.");
    }
  }

  async function sendMedia(file: File, kind: MediaKind, caption: string, slow: boolean) {
    const localUrl = URL.createObjectURL(file);
    const info = kind === "video" ? await readMediaInfo(localUrl, "video") : {};
    await deliver(draft(kind, caption, { local_url: localUrl, media_meta: info, slow }), async () => {
      const up = await uploadChatMedia(supabase, matchId, file, kind, slow);
      return { kind, body: caption, media_path: up.path, media_meta: { ...info, ...up.meta }, slow };
    });
  }

  // Can't wait for a slow reveal: pay to see it now
  async function revealSlow(m: ChatMessage) {
    const { error } = await supabase.rpc("reveal_slow", { p_message: m.id });
    if (error) return setToast(keysError(error.message));
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, slow_paid_at: new Date().toISOString() } : x)));
    refreshWallet();
  }

  async function sendVoice(blob: Blob, seconds: number, style: VoiceStyle = "normal") {
    const localUrl = URL.createObjectURL(blob);
    // A disguised voice is labelled so they know it's on purpose
    const voice = style !== "normal" ? { voice: style } : {};
    await deliver(draft("audio", "", { local_url: localUrl, media_meta: { duration: seconds, ...voice } }), async () => {
      const up = await uploadChatMedia(supabase, matchId, blob, "audio");
      return { kind: "audio", media_path: up.path, media_meta: { ...up.meta, duration: seconds, ...voice } };
    });
  }

  async function remove(m: ChatMessage) {
    setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: "", media_path: null } : x)));
    const { data: path } = await supabase.rpc("delete_message", { p_message: m.id });
    await removeChatMedia(supabase, (path as string | null) ?? m.media_path);
  }

  function callThem(kind: "audio" | "video") {
    startCall(matchId, kind, { name: other.display_name ?? "Your connection", photo: other.photos?.[0] });
  }

  async function report(reason: string) {
    await supabase.rpc("report_match", { p_match: matchId, p_reason: reason });
    router.replace("/matches");
    router.refresh();
  }

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-20 mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-cream lg:static lg:max-w-none">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 lg:px-5 lg:py-3.5">
        <Link href="/matches" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Back to matches">
          <ArrowLeft size={22} />
        </Link>
        <button onClick={() => setShowProfile(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-br from-brand to-[#c2306b] p-[2px]">
            <Avatar src={other.photos?.[0]} name={other.display_name} id={other.id} gender={other.gender} size={40} className="ring-2 ring-surface" />
            <span
              className={clsx("absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface", theyreOnline ? "bg-mint" : "bg-[#b9b3c4]")}
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">
              {other.display_name}
            </p>
            <p className={clsx("truncate text-[12px] font-medium", theyreOnline ? "text-mint" : "text-muted")}>{lastSeenText(seen[other.id], now)}</p>
          </div>
        </button>
        <button
          onClick={() => callThem("audio")}
          disabled={!!call}
          className="grid h-10 w-10 place-items-center rounded-full text-brand hover:bg-brand-soft disabled:opacity-40"
          aria-label={`Voice call ${other.display_name}`}
        >
          <Phone size={20} />
        </button>
        <button
          onClick={() => callThem("video")}
          disabled={!!call}
          className="grid h-10 w-10 place-items-center rounded-full text-brand hover:bg-brand-soft disabled:opacity-40"
          aria-label={`Video call ${other.display_name}`}
        >
          <Video size={21} />
        </button>
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
              <button
                onClick={async () => {
                  setMenu(false);
                  if (!confirm(`Remove ${other.display_name}? Your conversation will be deleted for both of you.`)) return;
                  await supabase.rpc("unmatch", { p_match: matchId });
                  router.replace("/matches");
                  router.refresh();
                }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-cream"
              >
                <UserX size={18} /> Remove connection
              </button>
              <button onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left text-[15px] text-chili hover:bg-chili-soft">
                <Flag size={18} /> Report & remove
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col" data-bg={bg !== "classic" ? "" : undefined} data-bg-dark={chatBgInfo(bg).dark ? "" : undefined}>
      <ChatBackdrop id={bg} />
      <div data-chat-scroll className="relative flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-4 mt-4 animate-fade-up rounded-3xl lg:mx-auto lg:max-w-xl border border-line bg-surface p-5 text-center shadow-card">
          <div className="flex justify-center -space-x-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-white ring-4 ring-surface">
              <MaskIcon className="w-8" eyes="#1c1828" />
            </span>
            <span className="rounded-full ring-4 ring-surface">
              <Avatar src={other.photos?.[0]} name={other.display_name} id={other.id} gender={other.gender} size={56} />
            </span>
          </div>
          <p className="mt-3 text-[16px] font-semibold">{source === "play" ? "You met over a game" : "You unmasked each other"}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted">
            {INTENT_ICONS[intent]({ size: 14 })} {intentLabel(intent)}
            {matchedAt && <> · {new Date(matchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>}
          </p>
          {shared.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {shared.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand-ink">
                  <InterestIcon name={t} size={13} /> {t}
                </span>
              ))}
            </div>
          )}
          {messages.length === 0 && <p className="mt-3 text-[14px] text-muted">Say hi to {other.display_name} 👋</p>}
        </div>
        <MessageList messages={messages} myId={myId} nameOf={nameOf} genderOf={(id) => (id === other.id ? other.gender : null)} onReply={setReplyTo} onDelete={remove} onReact={react} onEdit={(m) => { setReplyTo(null); setEditing(m); }} showDates onGameAgain={games.rematch} slow={{ cost: slowCost, onReveal: revealSlow }} />
      </div>
      </div>

      {games.banner}
      {/* Ideas to say are for masked chats; once you've both unmasked you know each other */}
      <Composer
        saveKey={`m-${matchId}`}
        plusDot={games.live}
        actions={[
          ...(games.canPlay ? [{ key: "game", label: games.live ? "Back to game" : "Play a game", icon: <Gamepad2 size={24} strokeWidth={1.75} />, tone: "bg-brand-soft text-brand", onClick: games.play }] : []),
          // Icebreakers are written for dating, so friendship chats don't get them
          ...(intent !== "friends"
            ? [{ key: "ice", label: "Icebreaker", icon: <Dices size={24} strokeWidth={1.75} />, tone: "bg-gold-soft text-[#9a6a0c]", onClick: () => void supabase.rpc("match_icebreaker", { p_match: matchId }).then(() => {}) }]
            : []),
        ]}
        onSend={send}
        onSendSticker={sendSticker}
        onSendScribble={sendScribble}
        editing={editing}
        onEdit={saveEdit}
        onCancelEdit={() => setEditing(null)}
        onSendMedia={sendMedia}
        onVoiceTap={() => setVoiceOpen(true)}
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.kind === "game" ? "the game" : nameOf(replyTo.sender_id)) : undefined}
        onCancelReply={() => setReplyTo(null)}
        onGift={() => {
          refreshWallet();
          setGiftOpen(true);
        }}
        placeholder={`Message ${other.display_name}`}
      />

      <ChatBgSheet
        open={bgOpen}
        onClose={() => setBgOpen(false)}
        value={bg}
        onPick={(id, everywhere) => {
          setSharedBg(id);
          iSetBg.current = id;
          if (everywhere) saveMyDefaultBg(id);
          // For both of you (before update 83 runs, it's kept on this phone instead)
          void supabase.rpc("set_chat_bg", { p_bg: id, p_match: matchId }).then(({ error }) => {
            if (error) saveChatBg(`m-${matchId}`, id, false);
          });
        }}
        them={other.display_name?.split(" ")[0] ?? "them"}
      />

      <MaskedVoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        sessionId=""
        allowNormal
        onSendBlob={async (blob, seconds, style) => {
          await sendVoice(blob, seconds, style);
          return null;
        }}
      />

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift animate-fade-up">
          {toast}
        </div>
      )}
      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        balance={wallet?.balance ?? null}
        toName={other.display_name ?? "them"}
        onSend={async (g) => {
          const { error } = await supabase.rpc("send_gift", { p_gift: g.id, p_match: matchId });
          if (!error && !activeNow()) notify({ kind: "message", matchId });
          if (error) return keysError(error.message);
          refreshWallet();
          return null;
        }}
      />
      {showProfile && <ProfileSheet profile={other} shared={shared} commonWith={other.id} onClose={() => setShowProfile(false)} />}
      {reporting && <ReportSheet onClose={() => setReporting(false)} onReport={report} />}
      {games.overlay}
    </div>
  );
}
