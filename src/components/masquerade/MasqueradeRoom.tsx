"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag, Gift, Handshake, LogOut, MoreVertical, Dices, RotateCcw, Timer, X } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftSheet, keysError } from "@/components/keys/GiftSheet";
import { useWallet } from "@/components/keys/useWallet";
import { EXTEND_COST, REOPEN_COST } from "@/lib/keys";
import { notify } from "@/lib/pushClient";
import { createClient } from "@/lib/supabase/client";
import { distanceLabel, GENDERS, intentLabel, MASQUERADE_MINUTES, spiceLabel } from "@/lib/constants";
import type { ChatMessage, MasqueradeState } from "@/lib/types";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Chilis } from "@/components/ui/Spice";
import { TimerRing } from "./TimerRing";
import { InterestTag } from "@/components/profile/InterestPicker";
import { DecisionSheet } from "./DecisionSheet";
import { Outcome } from "./Outcome";
import { ReportSheet } from "./ReportSheet";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";

const TOTAL = MASQUERADE_MINUTES * 60;

export function MasqueradeRoom({
  initial,
  initialMessages,
  demo,
  eventId = null,
}: {
  initial: MasqueradeState;
  initialMessages: ChatMessage[];
  demo?: { remaining: number; hideExtend?: boolean };
  /** Set when this chat is a round of a Masquerade Night */
  eventId?: string | null;
}) {
  const shell = useKeyboardSafe<HTMLDivElement>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initial);
  const [messages, setMessages] = useState(initialMessages);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [keysNote, setKeysNote] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
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

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("get_masquerade", { p_session: initial.id });
    if (data) setState(data as MasqueradeState);
  }, [supabase, initial.id]);

  // Tick the timer
  useEffect(() => {
    const t = setInterval(() => setRemaining(remainingNow()), 500);
    return () => clearInterval(t);
  }, [remainingNow]);

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "masquerade_sessions", filter: `id=eq.${initial.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, refresh, demo]);

  // Safety net: re-check every few seconds once the chat is over (and slowly during it)
  const timeUp = remaining <= 0;
  useEffect(() => {
    if (demo || state.status !== "active") return;
    const t = setInterval(refresh, timeUp ? 3000 : 10000);
    return () => clearInterval(t);
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
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      if (error || !data) return without;
      return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage];
    });
  }

  async function vote(unmask: boolean) {
    setVoting(true);
    setState((s) => ({ ...s, me: { ...s.me, vote: unmask } }));
    await supabase.rpc("vote_unmask", { p_session: state.id, p_unmask: unmask });
    await refresh();
    setVoting(false);
  }

  async function leave() {
    setMenu(false);
    if (
      !confirm(
        state.hourly
          ? `Let go of ${state.them.alias}? The chat closes for both of you. You'll get someone new next hour.`
          : "Leave this masquerade? The chat will be deleted.",
      )
    )
      return;
    await supabase.rpc("vote_unmask", { p_session: state.id, p_unmask: false });
    router.replace("/home");
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

  if (state.status !== "active" && state.status !== "lapsed") return <Outcome state={state} eventId={eventId} />;

  const them = state.them;
  const gender = GENDERS.find((g) => g.value === them.gender)?.label;
  const lapsed = state.status === "lapsed";
  const chatting = !lapsed && !timeUp;
  const total = state.hourly ? 3600 : TOTAL;

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-20 flex h-dvh overflow-hidden lg:static">
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-cream lg:max-w-none lg:flex-1">
      {/* Header */}
      <header className="z-10 border-b border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          {state.hourly && (
            <Link href="/home" className="-ml-2 grid h-10 w-8 shrink-0 place-items-center rounded-full hover:bg-ink/5" aria-label="Back home">
              <ArrowLeft size={22} />
            </Link>
          )}
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white">
            <MaskIcon className="w-7" eyes="#1c1828" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{them.alias}</p>
            <p className="truncate text-[13px] text-muted">
              {[them.age, gender, distanceLabel(them.distance_km) ?? intentLabel(state.intent)].join(" · ")}
            </p>
          </div>
          {lapsed ? (
            <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-muted">Hour over</span>
          ) : state.reopened ? (
            <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 text-[12px] font-semibold text-mint">Reopened</span>
          ) : (
            <TimerRing remaining={remaining} total={total} />
          )}
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
              {menu ? <X size={20} /> : <MoreVertical size={20} />}
            </button>
            {menu && (
              <div className="absolute top-11 right-0 w-48 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-fade-up">
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

        {/* What we know so far (shown in the side panel on computers) */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 no-scrollbar lg:hidden">
          <Tag>
            You <Chilis level={state.me.spice} />
          </Tag>
          <Tag>
            Them <Chilis level={them.spice} />
          </Tag>
          <Tag strong>Questions: {spiceLabel(state.spice_level)}</Tag>
          {[...(them.shared_interests ?? []), ...them.interests.filter((i) => !(them.shared_interests ?? []).includes(i))]
            .slice(0, 8)
            .map((i) => (
              <InterestTag key={i} name={i} highlight={(them.shared_interests ?? []).includes(i)} />
          ))}
        </div>
      </header>

      {/* Hourly pairs can unmask any time */}
      {state.hourly && !lapsed && (
        <div className="flex items-center gap-3 border-b border-line bg-brand-soft/60 px-4 py-2.5">
          <Handshake size={18} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            {state.me.vote === true ? (
              <>
                <span className="font-semibold text-ink">You chose to unmask.</span>{" "}
                <span className="text-muted">If {them.alias} does too, you&apos;re connected.</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">Feeling the vibe?</span>{" "}
                <span className="text-muted">{them.has_voted ? `${them.alias} has made a choice.` : "Unmask whenever you're ready."}</span>
              </>
            )}
          </p>
          {state.me.vote !== true && (
            <button
              type="button"
              onClick={() => vote(true)}
              disabled={voting}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white transition active:scale-95 disabled:opacity-60"
            >
              <MaskIcon className="w-5" eyes="#5b3fd9" /> Unmask
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div data-chat-scroll className="flex-1 overflow-y-auto overscroll-contain">
        <p className="px-6 pt-5 text-center text-[13px] leading-relaxed text-muted">
          You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. Names and photos stay hidden
          until you both unmask.
          {(them.shared_interests ?? []).length > 0 && (
            <span className="mt-2 block font-semibold text-brand">
              You both like {formatList(them.shared_interests)} ✓
            </span>
          )}
        </p>
        <MessageList
          messages={messages}
          myId={state.me.id}
          nameOf={(id) => (id === state.me.id ? "You" : state.them.alias)}
          onReply={setReplyTo}
        />
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
      {keysNote && (
        <div className="flex items-center gap-3 border-t border-line bg-gold-soft px-4 py-2.5 text-[13px]">
          <p className="flex-1 font-medium text-[#8a5a00]">{keysNote}</p>
          <Link href="/wallet" target="_blank" className="shrink-0 font-semibold text-brand">Get Keys</Link>
          <button onClick={() => setKeysNote(null)} aria-label="Dismiss" className="text-muted"><X size={16} /></button>
        </div>
      )}

      {lapsed && (
        <div className="animate-fade-up border-t border-line bg-surface px-5 pt-4 pb-safe">
          <p className="text-center text-[15px] font-semibold">The hour ran out before you both decided</p>
          <p className="mx-auto mt-1 max-w-sm text-center text-[13px] leading-snug text-muted">
            {state.me.vote === true
              ? `You unmasked. If ${them.alias} unmasks too, you're connected.`
              : `Unmask now, and if ${them.alias} does too, you're connected. Or reopen the chat to keep talking.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 pb-2">
            {state.me.vote !== true ? (
              <button
                type="button"
                onClick={() => vote(true)}
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
              {reopening ? <Spinner className="h-4 w-4" /> : <RotateCcw size={17} />} Reopen · <KeyCoin size={16} /> {REOPEN_COST}
            </button>
          </div>
          <button type="button" onClick={leave} className="mx-auto mb-2 block text-[13px] font-semibold text-muted hover:text-chili">
            Let go
          </button>
        </div>
      )}

      {chatting ? (
        <Composer
          onSend={send}
          replyTo={replyTo}
          replyName={replyTo ? (replyTo.sender_id === state.me.id ? "yourself" : replyTo.sender_id ? state.them.alias : "the icebreaker") : undefined}
          onCancelReply={() => setReplyTo(null)}
          leading={
            <button
              type="button"
              onClick={nextQuestion}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-soft text-[#9a6a0c]"
              aria-label="New icebreaker question"
              title="New icebreaker"
            >
              <Dices size={20} />
            </button>
          }
          trailingExtra={
            <button
              type="button"
              onClick={() => {
                refreshWallet();
                setGiftOpen(true);
              }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-chili-soft text-chili"
              aria-label="Send a gift"
              title="Send a gift"
            >
              <Gift size={20} />
            </button>
          }
        />
      ) : null}

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        balance={wallet?.balance ?? null}
        toName={them.alias}
        onSend={async (g) => {
          const { error } = await supabase.rpc("send_gift", { p_gift: g.id, p_session: state.id });
          if (error) return keysError(error.message);
          refreshWallet();
          return null;
        }}
      />
      {timeUp && !state.hourly && <DecisionSheet state={state} voting={voting} onVote={vote} />}
      {reporting && <ReportSheet onClose={() => setReporting(false)} onReport={report} />}
    </div>

    {/* About them — side panel on computers */}
    <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface px-6 py-8 lg:flex">
      <div className="flex flex-col items-center text-center">
        <span className="grid h-24 w-24 animate-float place-items-center rounded-full bg-ink text-white shadow-lift">
          <MaskIcon className="w-14" eyes="#1c1828" />
        </span>
        <p className="mt-4 font-display text-[26px] font-semibold">{them.alias}</p>
        <p className="text-[14px] text-muted">
          {[them.age, gender, distanceLabel(them.distance_km)].filter(Boolean).join(" · ")}
        </p>
        {!lapsed && !state.reopened && (
          <>
            <div className="mt-5">
              <TimerRing remaining={remaining} total={total} />
            </div>
            <p className="mt-1 text-[12px] text-muted">{state.hourly ? "left this hour" : "until you both decide"}</p>
          </>
        )}
      </div>

      <h3 className="mt-8 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Here for</h3>
      <p className="text-[15px] font-semibold">{intentLabel(state.intent)}</p>

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

      <h3 className="mt-6 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Into</h3>
      <div className="flex flex-wrap gap-2">
        {[...(them.shared_interests ?? []), ...them.interests.filter((i) => !(them.shared_interests ?? []).includes(i))].map((i) => (
          <InterestTag key={i} name={i} highlight={(them.shared_interests ?? []).includes(i)} />
        ))}
      </div>
      {(them.shared_interests ?? []).length > 0 && (
        <p className="mt-2 text-[13px] font-semibold text-brand">You both like {formatList(them.shared_interests)} ✓</p>
      )}

      <p className="mt-auto rounded-2xl bg-cream p-4 text-[13px] leading-relaxed text-muted">
        You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. Names and photos stay hidden until you both unmask.
      </p>
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
