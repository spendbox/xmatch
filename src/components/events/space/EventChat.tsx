"use client";

import { refreshMenuBadges } from "@/components/app/useMenuBadges";
import { sexLabel } from "@/lib/eventSpace";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlarmClock, ArrowLeft, Check, Clock3, Eye, Heart, HeartHandshake, HeartOff, MoreVertical, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countdown, eventPhase, settingsOf, type EventChatDetail, type EventChatMessage } from "@/lib/events";
import { eventError } from "@/lib/eventSpace";
import type { ChatMessage } from "@/lib/types";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { useWallet } from "@/components/keys/useWallet";
import { useNow } from "../EventCard";
import { useEventMedia } from "../media/EventMediaProvider";
import { MiniPlayer } from "../media/MiniPlayer";
import { BlurPhoto, PersonSheet, revealPrice } from "./common";

const toMsg = (m: EventChatMessage): ChatMessage => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, kind: "text" });

/** A private chat started at a Spotlight Night or Listening Party. */
export function EventChat({ chat, myId, myInterests }: { chat: EventChatDetail; myId: string; myInterests: string[] }) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const e = chat.event;
  const s = settingsOf(e);
  const now = useNow();
  const phase = now ? eventPhase(e, now) : "live";
  const endTime = new Date(e.ends_at).getTime();
  const endsIn = now ? endTime - now : Infinity;
  const decideBy = endTime + 60 * 60 * 1000;
  const canDecide = phase === "ended" && (now ?? 0) < decideBy;
  const lastCall = phase === "live" && endsIn <= 10 * 60 * 1000;

  const [messages, setMessages] = useState<ChatMessage[]>(() => chat.messages.map(toMsg));
  const [status, setStatus] = useState(chat.status);
  const [myKeep, setMyKeep] = useState(chat.my_keep);
  const [matchId, setMatchId] = useState(chat.match_id);
  const [celebrate, setCelebrate] = useState(false);
  const [gone, setGone] = useState(false);
  const [other, setOther] = useState(chat.other);
  const [revealsUsed, setRevealsUsed] = useState(e.reveals_used ?? 0);
  const [sheet, setSheet] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [voting, setVoting] = useState<null | "keep" | "go">(null);
  const { wallet, refresh: refreshWallet } = useWallet(myId);
  const media = useEventMedia();
  const showPlayer = media.active?.id === e.id && s.media_under_chats !== false;
  const name = other.name || "them";
  const nameOf = (id: string | null) => (id === myId ? "You" : other.name || "Them");

  // Opening the chat (and anything that arrives while it's open) counts as read
  useEffect(() => {
    supabase.rpc("mark_event_chat_read", { p_chat: chat.id }).then(() => refreshMenuBadges());
  }, [supabase, chat.id, messages.length]);

  const matched = useCallback((mid: string | null) => {
    setStatus("matched");
    if (mid) setMatchId(mid);
    setCelebrate(true);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`event-chat-${chat.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_chat_messages", filter: `chat_id=eq.${chat.id}` }, (p) => {
        const m = toMsg(p.new as EventChatMessage);
        setMessages((l) => {
          if (l.some((x) => x.id === m.id)) return l;
          // Swap my draft for the saved copy
          const i = m.sender_id === myId ? l.findIndex((x) => x.pending && x.body === m.body) : -1;
          if (i >= 0) return [...l.slice(0, i), m, ...l.slice(i + 1)];
          return [...l, m];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_chats", filter: `id=eq.${chat.id}` }, (p) => {
        const row = p.new as { status: string; match_id: string | null };
        if (row.status === "matched") matched(row.match_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_chats" }, (p) => {
        if ((p.old as { id?: string }).id === chat.id) setGone(true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, chat.id, myId, matched]);

  // While waiting on their decision, check in now and then
  useEffect(() => {
    if (phase !== "ended" || status !== "open" || gone) return;
    const t = setInterval(async () => {
      const { data } = await supabase.rpc("get_event_chat", { p_chat: chat.id });
      const d = data as EventChatDetail | null;
      if (!d) setGone(true);
      else if (d.status === "matched") matched(d.match_id);
    }, 20_000);
    return () => clearInterval(t);
  }, [phase, status, gone, supabase, chat.id, matched]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function send(text: string) {
    const temp: ChatMessage = { id: -Date.now(), sender_id: myId, kind: "text", body: text, created_at: new Date().toISOString(), pending: true };
    setMessages((l) => [...l, temp]);
    const { data, error } = await supabase
      .from("event_chat_messages")
      .insert({ chat_id: chat.id, sender_id: myId, body: text })
      .select("id, sender_id, body, created_at")
      .single();
    if (error || !data) {
      setMessages((l) => l.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      setToast(eventError(error?.message ?? "Message not sent. Check your connection."));
      return;
    }
    const saved = toMsg(data as EventChatMessage);
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      return without.some((m) => m.id === saved.id) ? without : [...without, saved];
    });
  }

  async function vote(keep: boolean) {
    if (!keep && !confirm(`Let go of your chat with ${name}? It will be deleted for both of you.`)) return;
    setMenu(false);
    setVoting(keep ? "keep" : "go");
    const { data, error } = await supabase.rpc("vote_event_chat", { p_chat: chat.id, p_keep: keep });
    setVoting(null);
    if (error) return setToast(eventError(error.message));
    const r = data as { status: string; match_id?: string };
    if (r.status === "matched") return matched(r.match_id ?? null);
    if (r.status === "closed") {
      router.replace(`/events/${e.id}`);
      router.refresh();
      return;
    }
    setMyKeep(true);
    setToast(`Kept. If ${name} keeps it too, it's a match.`);
  }

  async function reveal() {
    setRevealing(true);
    setSheetError(null);
    const { data, error } = await supabase.rpc("reveal_photo", { p_event: e.id, p_target: other.id });
    setRevealing(false);
    if (error) return setSheetError(eventError(error.message));
    const r = data as { photo: string; paid: number };
    setOther((o) => ({ ...o, photo: r.photo }));
    setRevealsUsed((u) => u + 1);
    if (r.paid) refreshWallet();
  }

  const price = revealPrice(s, revealsUsed);
  const byTime = new Date(decideBy).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const open = status === "open" && !gone;

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-20 mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-cream lg:static lg:max-w-3xl lg:border-x lg:border-line">
      <header className="flex items-center gap-1.5 border-b border-line bg-surface px-2 py-2.5 lg:px-5 lg:py-3.5">
        <Link href={`/events/${e.id}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-ink/5" aria-label="Back to the event">
          <ArrowLeft size={22} />
        </Link>
        <button onClick={() => { setSheetError(null); setSheet(true); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="inline-flex shrink-0 rounded-full bg-gradient-to-br from-brand to-[#c2306b] p-[2px]">
            <BlurPhoto blur={other.blur} photo={other.photo} alt={other.name} soft className="h-10 w-10 rounded-full ring-2 ring-surface" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">
              {other.name || "Someone"}
              {other.age ? `, ${other.age}` : ""}
              {sexLabel(other.gender) && <span className="font-normal text-muted"> · {sexLabel(other.gender)}</span>}
            </p>
            <p className={clsx("inline-flex items-center gap-1 text-[12px] font-medium", lastCall ? "text-[#9a6a0c]" : "text-muted")}>
              <Clock3 size={12} />
              {phase === "live" ? `Ends in ${countdown(endsIn)}` : canDecide ? `Event over · decide by ${byTime}` : phase === "upcoming" ? "Not started" : "Event over"}
            </p>
          </div>
        </button>
        {!other.photo && open && (
          <button
            onClick={() => { setSheetError(null); setSheet(true); }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-brand hover:bg-brand-soft sm:inline-flex sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[13px] sm:font-semibold"
            aria-label="Reveal photo"
          >
            <Eye size={19} /> <span className="hidden sm:inline">Reveal</span>
          </button>
        )}
        {open && phase !== "ended" && (
          <button
            onClick={() => (myKeep ? setToast(`You kept this chat. If ${name} keeps it too, it's a match.`) : vote(true))}
            disabled={!!voting}
            className={clsx(
              "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition active:scale-95 disabled:opacity-60",
              myKeep ? "bg-mint-soft text-mint" : "bg-brand text-white",
            )}
          >
            {myKeep ? <Check size={15} strokeWidth={3} /> : <Heart size={15} />} {myKeep ? "Kept" : "Keep"}
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
                  <HeartOff size={18} /> Let go
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {showPlayer && <MiniPlayer className="border-b border-line bg-cream px-3 py-2 lg:px-5" />}

      {lastCall && open && (
        <div className="flex animate-fade-up items-center gap-3 border-b border-gold/40 bg-gold-soft px-4 py-2.5">
          <AlarmClock size={18} className="shrink-0 text-[#9a6a0c]" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-ink">10 minutes left — keep the chats you like</p>
          {!myKeep && (
            <button onClick={() => vote(true)} disabled={!!voting} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
              Keep
            </button>
          )}
        </div>
      )}

      <div data-chat-scroll className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-4 mt-4 animate-fade-up rounded-3xl border border-line bg-surface p-5 text-center shadow-card">
          <BlurPhoto blur={other.blur} photo={other.photo} alt={other.name} className="mx-auto h-16 w-16 rounded-full ring-4 ring-brand-soft" />
          <p className="mt-3 text-[16px] font-semibold">
            {chat.messages.length === 0 && messages.length === 0 ? `Say hi to ${other.name || "them"}` : `You met at ${e.title}`}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-snug text-muted">
            This chat lasts until the event ends. Then you both choose: keep it and it&apos;s a match, or let it go.
          </p>
        </div>
        <MessageList messages={messages} myId={myId} nameOf={nameOf} />
      </div>

      {gone ? (
        <EndCard
          icon={<HeartOff size={22} />}
          title="This chat has ended"
          body={`${other.name || "They"} let this chat go. There are plenty more people to meet.`}
        >
          <ButtonLink href={`/events/${e.id}`} variant="secondary" size="lg">Back to the event</ButtonLink>
        </EndCard>
      ) : status === "matched" ? (
        <EndCard icon={<HeartHandshake size={22} />} title="It's a match!" body="Your conversation has moved to Chats.">
          {matchId && <ButtonLink href={`/matches/${matchId}`} size="lg">Open your chat</ButtonLink>}
        </EndCard>
      ) : phase === "ended" ? (
        canDecide ? (
          myKeep ? (
            <EndCard icon={<Clock3 size={22} />} title={`Waiting for ${other.name || "them"}`} body={`You kept this chat. If ${name} keeps it too, it's a match. They have until ${byTime}.`}>
              <button onClick={() => vote(false)} disabled={!!voting} className="text-[13px] font-semibold text-muted underline-offset-2 hover:text-chili hover:underline">
                Let go instead
              </button>
            </EndCard>
          ) : (
            <EndCard
              icon={<Heart size={22} />}
              title={`Keep chatting with ${other.name || "them"}?`}
              body={chat.their_keep_set ? `${other.name || "They"} has made their choice. Now it's yours.` : "If you both keep it, it's a match and the chat moves to your Chats."}
            >
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="secondary" size="lg" onClick={() => vote(false)} loading={voting === "go"} disabled={!!voting}>
                  <X size={18} /> Let go
                </Button>
                <Button size="lg" onClick={() => vote(true)} loading={voting === "keep"} disabled={!!voting}>
                  <Heart size={18} /> Keep
                </Button>
              </div>
            </EndCard>
          )
        ) : (
          <EndCard icon={<Clock3 size={22} />} title="This chat has closed" body="The time to decide has passed.">
            <ButtonLink href="/events" variant="secondary" size="lg">See other events</ButtonLink>
          </EndCard>
        )
      ) : (
        <Composer onSend={send} disabled={phase !== "live"} placeholder={phase === "live" ? `Message ${other.name || "them"}` : "The event hasn't started"} />
      )}

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm animate-fade-up rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift">
          {toast}
        </div>
      )}

      <PersonSheet
        open={sheet}
        onClose={() => setSheet(false)}
        person={{ name: other.name, age: other.age, gender: other.gender, blur: other.blur, photo: other.photo, revealed: !!other.photo, interests: other.interests ?? [] }}
        myInterests={myInterests}
        price={price}
        balance={wallet?.balance ?? null}
        revealing={revealing}
        onReveal={reveal}
        error={sheetError}
      />

      {celebrate && <Celebration name={other.name || "them"} matchId={matchId} eventId={e.id} onClose={() => setCelebrate(false)} />}
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

function Celebration({ name, matchId, eventId, onClose }: { name: string; matchId: string | null; eventId: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="It's a match" className="fixed inset-0 z-[70] grid animate-fade-in place-items-center overflow-hidden bg-gradient-to-br from-brand via-[#8f3fd9] to-[#c2306b] p-6 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <Heart
            key={i}
            size={18 + ((i * 7) % 22)}
            fill="currentColor"
            className="dp-pop-heart absolute bottom-0 text-white/30"
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.37) % 2.8}s` }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-sm animate-pop text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20">
          <HeartHandshake size={40} />
        </span>
        <h2 className="mt-5 font-display text-[40px] leading-none font-semibold">It&apos;s a match!</h2>
        <p className="mt-3 text-[16px] text-white/85">You and {name} both kept the chat. Your messages are waiting in Chats.</p>
        <div className="mt-7 grid gap-2.5">
          {matchId && (
            <Link href={`/matches/${matchId}`} className="inline-flex h-14 items-center justify-center rounded-2xl bg-white text-[16px] font-semibold text-brand shadow-lift active:scale-[0.98]">
              Open your chat
            </Link>
          )}
          <Link href={`/events/${eventId}`} onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-white/90 hover:bg-white/10">
            Back to the event
          </Link>
        </div>
      </div>
    </div>
  );
}
