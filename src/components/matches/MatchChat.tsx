"use client";

import { notify } from "@/lib/pushClient";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dices, Flag, Gamepad2, UserX, MoreVertical, Phone, Video, X } from "lucide-react";
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

export function MatchChat({
  matchId,
  myId,
  other,
  initialMessages,
  shared = [],
  matchedAt,
  intent = "dating",
  slowCost = 10,
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
}) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const { seen, now } = usePresence([other.id]);
  const theyreOnline = isOnline(seen[other.id], now);
  const activeNow = () => !!seen[other.id] && Date.now() - new Date(seen[other.id]).getTime() < 45_000;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [menu, setMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
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

  const COLUMNS = "id, sender_id, kind, body, created_at, media_path, media_meta, reply_to, deleted_at, slow, slow_paid_at";

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

  async function sendVoice(blob: Blob, seconds: number) {
    const localUrl = URL.createObjectURL(blob);
    await deliver(draft("audio", "", { local_url: localUrl, media_meta: { duration: seconds } }), async () => {
      const up = await uploadChatMedia(supabase, matchId, blob, "audio");
      return { kind: "audio", media_path: up.path, media_meta: { ...up.meta, duration: seconds } };
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
            <Avatar src={other.photos?.[0]} name={other.display_name} size={40} className="ring-2 ring-surface" />
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

      <div data-chat-scroll className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-4 mt-4 animate-fade-up rounded-3xl border border-line bg-surface p-5 text-center shadow-card">
          <div className="flex justify-center -space-x-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-white ring-4 ring-surface">
              <MaskIcon className="w-8" eyes="#1c1828" />
            </span>
            <span className="rounded-full ring-4 ring-surface">
              <Avatar src={other.photos?.[0]} name={other.display_name} size={56} />
            </span>
          </div>
          <p className="mt-3 text-[16px] font-semibold">You unmasked each other</p>
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
        <MessageList messages={messages} myId={myId} nameOf={nameOf} onReply={setReplyTo} onDelete={remove} showDates onGameAgain={games.rematch} slow={{ cost: slowCost, onReveal: revealSlow }} />
      </div>

      {games.banner}
      {/* Ideas to say are for masked chats; once you've both unmasked you know each other */}
      <Composer
        plusDot={games.live}
        actions={[
          ...(games.canPlay ? [{ key: "game", label: games.live ? "Back to game" : "Play a game", icon: <Gamepad2 size={24} strokeWidth={1.75} />, tone: "bg-brand-soft text-brand", onClick: games.play }] : []),
          // Icebreakers are written for dating, so friendship chats don't get them
          ...(intent !== "friends"
            ? [{ key: "ice", label: "Icebreaker", icon: <Dices size={24} strokeWidth={1.75} />, tone: "bg-gold-soft text-[#9a6a0c]", onClick: () => void supabase.rpc("match_icebreaker", { p_match: matchId }).then(() => {}) }]
            : []),
        ]}
        onSend={send}
        onSendMedia={sendMedia}
        onSendVoice={sendVoice}
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.kind === "game" ? "the game" : nameOf(replyTo.sender_id)) : undefined}
        onCancelReply={() => setReplyTo(null)}
        onGift={() => {
          refreshWallet();
          setGiftOpen(true);
        }}
        placeholder={`Message ${other.display_name}`}
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
