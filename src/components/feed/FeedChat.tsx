"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlarmClock, ArrowLeft, Check, Clock3, DoorOpen, Handshake, MoreVertical, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { sexLabel } from "@/lib/eventSpace";
import { feedError, timeLeft, type FeedChatDetail, type FeedChatMessage } from "@/lib/feed";
import type { ChatMessage } from "@/lib/types";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";
import { MaskAvatar } from "./MaskAvatar";

const toMsg = (m: FeedChatMessage): ChatMessage => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, kind: "text" });

/** A 24-hour masked chat started from the Feed. */
export function FeedChat({ chat, myId }: { chat: FeedChatDetail; myId: string }) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [now, setNow] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => chat.messages.map(toMsg));
  const [status, setStatus] = useState(chat.status);
  const [myKeep, setMyKeep] = useState(chat.my_keep);
  const [matchId, setMatchId] = useState(chat.match_id);
  const [celebrate, setCelebrate] = useState(false);
  const [gone, setGone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [voting, setVoting] = useState<null | "keep" | "go">(null);

  const other = chat.other;
  const name = other.name || "them";
  const nameOf = (id: string | null) => (id === myId ? "You" : other.name || "Them");
  const ends = new Date(chat.expires_at).getTime();
  const decideBy = new Date(chat.decide_by).getTime();
  const t = now ?? 0;
  const live = !now || t < ends;
  const canDecide = !live && t < decideBy;
  const lastHour = live && now !== null && ends - t <= 60 * 60 * 1000;
  const open = status === "open" && !gone;

  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    supabase.rpc("mark_feed_chat_read", { p_chat: chat.id }).then(() => refreshMenuBadges());
  }, [supabase, chat.id, messages.length]);

  const matched = useCallback((mid: string | null) => {
    setStatus("matched");
    if (mid) setMatchId(mid);
    setCelebrate(true);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`feed-chat-${chat.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_chat_messages", filter: `chat_id=eq.${chat.id}` }, (p) => {
        const m = toMsg(p.new as FeedChatMessage);
        setMessages((l) => {
          if (l.some((x) => x.id === m.id)) return l;
          const i = m.sender_id === myId ? l.findIndex((x) => x.pending && x.body === m.body) : -1;
          if (i >= 0) return [...l.slice(0, i), m, ...l.slice(i + 1)];
          return [...l, m];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "feed_chats", filter: `id=eq.${chat.id}` }, (p) => {
        const row = p.new as { status: string; match_id: string | null };
        if (row.status === "matched") matched(row.match_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "feed_chats", filter: `id=eq.${chat.id}` }, () => setGone(true))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, chat.id, myId, matched]);

  // After the 24 hours, check now and then whether they decided
  useEffect(() => {
    if (live || status !== "open" || gone) return;
    const i = setInterval(async () => {
      const { data } = await supabase.rpc("get_feed_chat", { p_chat: chat.id });
      const d = data as FeedChatDetail | null;
      if (!d) setGone(true);
      else if (d.status === "matched") matched(d.match_id);
    }, 20_000);
    return () => clearInterval(i);
  }, [live, status, gone, supabase, chat.id, matched]);

  useEffect(() => {
    if (!toast) return;
    const i = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(i);
  }, [toast]);

  async function send(text: string) {
    const temp: ChatMessage = { id: -Date.now(), sender_id: myId, kind: "text", body: text, created_at: new Date().toISOString(), pending: true };
    setMessages((l) => [...l, temp]);
    const { data, error } = await supabase
      .from("feed_chat_messages")
      .insert({ chat_id: chat.id, sender_id: myId, body: text })
      .select("id, sender_id, body, created_at")
      .single();
    if (error || !data) {
      setMessages((l) => l.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      setToast(feedError(error?.message ?? "Message not sent. Check your connection."));
      return;
    }
    notify({ kind: "feed_message", chatId: chat.id });
    const saved = toMsg(data as FeedChatMessage);
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      return without.some((m) => m.id === saved.id) ? without : [...without, saved];
    });
  }

  async function vote(keep: boolean) {
    if (!keep && !confirm(`Let go of your chat with ${name}? It will be deleted for both of you.`)) return;
    setMenu(false);
    setVoting(keep ? "keep" : "go");
    const { data, error } = await supabase.rpc("vote_feed_chat", { p_chat: chat.id, p_keep: keep });
    setVoting(null);
    if (error) return setToast(feedError(error.message));
    const r = data as { status: string; match_id?: string };
    if (r.status === "matched") {
      notify({ kind: "feed_match", chatId: chat.id });
      return matched(r.match_id ?? null);
    }
    if (r.status === "closed") {
      router.replace("/feed");
      router.refresh();
      return;
    }
    setMyKeep(true);
    setToast(`Kept. If ${name} keeps it too, it's a match.`);
  }

  const byTime = new Date(decideBy).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-20 mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-cream lg:static lg:max-w-3xl lg:border-x lg:border-line">
      <header className="flex items-center gap-1.5 border-b border-line bg-surface px-2 py-2.5 lg:px-5 lg:py-3.5">
        <Link href="/feed" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-ink/5" aria-label="Back to the feed">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MaskAvatar alias={other.name} photo={other.masked ? null : other.photo} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{other.name || "Someone"}</p>
            <p className={clsx("flex items-center gap-1 truncate text-[12px] font-medium", lastHour ? "text-[#9a6a0c]" : "text-muted")}>
              {[other.age, sexLabel(other.gender)].filter(Boolean).join(" · ")}
              {(other.age || other.gender) && " · "}
              <Clock3 size={12} className="shrink-0" />
              {live ? (now ? timeLeft(ends - t) : "24h chat") : canDecide ? `Time's up · decide by ${byTime}` : "Closed"}
            </p>
          </div>
        </div>
        {open && live && (
          <button
            onClick={() => (myKeep ? setToast(`You kept this chat. If ${name} keeps it too, it's a match.`) : vote(true))}
            disabled={!!voting}
            className={clsx(
              "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition active:scale-95 disabled:opacity-60",
              myKeep ? "bg-mint-soft text-mint" : "bg-brand text-white",
            )}
          >
            {myKeep ? <Check size={15} strokeWidth={3} /> : <Handshake size={15} />} {myKeep ? "Kept" : "Keep"}
          </button>
        )}
        {open && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
              {menu ? <X size={20} /> : <MoreVertical size={20} />}
            </button>
            {menu && (
              <div className="absolute top-11 right-0 z-30 w-52 animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
                <button onClick={() => vote(false)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-chili hover:bg-chili-soft">
                  <DoorOpen size={18} /> Let go
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {lastHour && open && (
        <div className="flex animate-fade-up items-center gap-3 border-b border-gold/40 bg-gold-soft px-4 py-2.5">
          <AlarmClock size={18} className="shrink-0 text-[#9a6a0c]" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-ink">Less than an hour left. Keep it if you want to match.</p>
          {!myKeep && (
            <button onClick={() => vote(true)} disabled={!!voting} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
              Keep
            </button>
          )}
        </div>
      )}

      <div data-chat-scroll className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-4 mt-4 animate-fade-up rounded-3xl border border-line bg-surface p-5 shadow-card">
          {chat.prompt_body && <p className="text-[12px] font-semibold tracking-wide text-brand uppercase">{chat.prompt_body}</p>}
          {chat.answer_body && (
            <p className="mt-2 text-[15px] leading-snug">
              <span className="text-muted">{chat.answer_mine ? "You answered: " : `${other.masked ? other.name : "They"} answered: `}</span>
              &ldquo;{chat.answer_body}&rdquo;
            </p>
          )}
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-snug text-muted">
            You&apos;re {chat.me.masked ? <b className="text-ink">{chat.me.name}</b> : "yourself"} here. This chat lasts 24 hours. Keep it to match: if you both
            keep it, you see each other and it moves to Chats.
          </p>
        </div>
        <MessageList messages={messages} myId={myId} nameOf={nameOf} />
      </div>

      {gone ? (
        <EndCard icon={<DoorOpen size={22} />} title="This chat has ended" body={`${other.name || "They"} let this chat go. Plenty more answers to explore.`}>
          <ButtonLink href="/feed" variant="secondary" size="lg">Back to the feed</ButtonLink>
        </EndCard>
      ) : status === "matched" ? (
        <EndCard icon={<Handshake size={22} />} title="It's a match!" body="Your conversation has moved to Chats.">
          {matchId && <ButtonLink href={`/matches/${matchId}`} size="lg">Open your chat</ButtonLink>}
        </EndCard>
      ) : !live ? (
        canDecide ? (
          myKeep ? (
            <EndCard icon={<Clock3 size={22} />} title={`Waiting for ${name}`} body={`You kept this chat. If ${name} keeps it too, it's a match. They have until ${byTime}.`}>
              <button onClick={() => vote(false)} disabled={!!voting} className="text-[13px] font-semibold text-muted underline-offset-2 hover:text-chili hover:underline">
                Let go instead
              </button>
            </EndCard>
          ) : (
            <EndCard
              icon={<Handshake size={22} />}
              title={`Keep chatting with ${name}?`}
              body={chat.their_keep_set ? `${other.name || "They"} has made their choice. Now it's yours.` : "If you both keep it, it's a match and the chat moves to your Chats."}
            >
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="secondary" size="lg" onClick={() => vote(false)} loading={voting === "go"} disabled={!!voting}>
                  <X size={18} /> Let go
                </Button>
                <Button size="lg" onClick={() => vote(true)} loading={voting === "keep"} disabled={!!voting}>
                  <Handshake size={18} /> Keep
                </Button>
              </div>
            </EndCard>
          )
        ) : (
          <EndCard icon={<Clock3 size={22} />} title="This chat has closed" body="The time to decide has passed.">
            <ButtonLink href="/feed" variant="secondary" size="lg">Back to the feed</ButtonLink>
          </EndCard>
        )
      ) : (
        <Composer onSend={send} placeholder={`Message ${other.name || "them"}`} />
      )}

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm animate-fade-up rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift">
          {toast}
        </div>
      )}

      {celebrate && (
        <div role="dialog" aria-modal="true" aria-label="It's a match" className="fixed inset-0 z-[70] grid animate-fade-in place-items-center bg-gradient-to-br from-brand via-[#8f3fd9] to-[#c2306b] p-6 text-white">
          <div className="w-full max-w-sm animate-pop text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20">
              <MaskIcon className="w-11 text-white" eyes="#8f3fd9" />
            </span>
            <h2 className="mt-5 font-display text-[40px] leading-none font-semibold">It&apos;s a match!</h2>
            <p className="mt-3 text-[16px] text-white/85">You and {name} both kept the chat. The masks are off, and your messages are waiting in Chats.</p>
            <div className="mt-7 grid gap-2.5">
              {matchId && (
                <Link href={`/matches/${matchId}`} className="inline-flex h-14 items-center justify-center rounded-2xl bg-white text-[16px] font-semibold text-brand shadow-lift active:scale-[0.98]">
                  Open your chat
                </Link>
              )}
              <Link href="/feed" className="inline-flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-white/90 hover:bg-white/10">
                Back to the feed
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EndCard({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="animate-fade-up border-t border-line bg-surface px-5 pt-5 pb-safe text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      <p className="mt-2 text-[17px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[14px] leading-snug text-muted">{body}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
