"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, LogOut, MoreVertical, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GENDERS, intentLabel, MASQUERADE_MINUTES, spiceLabel } from "@/lib/constants";
import type { ChatMessage, MasqueradeState } from "@/lib/types";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Chilis } from "@/components/ui/Spice";
import { TimerRing } from "./TimerRing";
import { DecisionSheet } from "./DecisionSheet";
import { Outcome } from "./Outcome";
import { ReportSheet } from "./ReportSheet";

const TOTAL = MASQUERADE_MINUTES * 60;

export function MasqueradeRoom({
  initial,
  initialMessages,
  demo,
}: {
  initial: MasqueradeState;
  initialMessages: ChatMessage[];
  demo?: { remaining: number };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initial);
  const [messages, setMessages] = useState(initialMessages);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [voting, setVoting] = useState(false);
  // Keep our clock in step with the server's so both timers match
  const offset = useRef(new Date(initial.server_now).getTime() - Date.now());
  const remainingNow = useCallback(
    () => (demo ? demo.remaining : (new Date(state.ends_at).getTime() - (Date.now() + offset.current)) / 1000),
    [state.ends_at, demo],
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
    const temp: ChatMessage = { id: -Date.now(), sender_id: state.me.id, kind: "text", body: text, created_at: new Date().toISOString() };
    setMessages((l) => [...l, temp]);
    const { data, error } = await supabase
      .from("masquerade_messages")
      .insert({ session_id: state.id, sender_id: state.me.id, body: text })
      .select("id, sender_id, kind, body, created_at")
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
    if (!confirm("Leave this masquerade? The chat will be deleted.")) return;
    await supabase.rpc("vote_unmask", { p_session: state.id, p_unmask: false });
    router.replace("/masquerade");
  }

  async function report(reason: string) {
    await supabase.rpc("report_masquerade", { p_session: state.id, p_reason: reason });
    setReporting(false);
    await refresh();
  }

  async function nextQuestion() {
    await supabase.rpc("next_icebreaker", { p_session: state.id });
  }

  if (state.status !== "active") return <Outcome state={state} />;

  const them = state.them;
  const gender = GENDERS.find((g) => g.value === them.gender)?.label;
  const chatting = !timeUp;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-cream">
      {/* Header */}
      <header className="z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white">
            <MaskIcon className="w-7" eyes="#1c1828" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{them.alias}</p>
            <p className="truncate text-[13px] text-muted">
              {them.age} · {gender} · {intentLabel(state.intent)}
            </p>
          </div>
          <TimerRing remaining={remaining} total={TOTAL} />
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
              {menu ? <X size={20} /> : <MoreVertical size={20} />}
            </button>
            {menu && (
              <div className="absolute top-11 right-0 w-48 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-fade-up">
                <button onClick={leave} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-cream">
                  <LogOut size={18} /> Leave chat
                </button>
                <button onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left text-[15px] text-chili hover:bg-chili-soft">
                  <Flag size={18} /> Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* What we know so far */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
          <Tag>
            You <Chilis level={state.me.spice} />
          </Tag>
          <Tag>
            Them <Chilis level={them.spice} />
          </Tag>
          <Tag strong>Questions: {spiceLabel(state.spice_level)}</Tag>
          {them.interests.slice(0, 6).map((i) => (
            <Tag key={i}>{i}</Tag>
          ))}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-6 pt-5 text-center text-[13px] leading-relaxed text-muted">
          You&apos;re <span className="font-semibold text-ink">{state.me.alias}</span>. Names and photos stay hidden
          until you both unmask.
        </p>
        <MessageList messages={messages} myId={state.me.id} />
      </div>

      {chatting ? (
        <Composer
          onSend={send}
          leading={
            <button
              type="button"
              onClick={nextQuestion}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-soft text-[#9a6a0c]"
              aria-label="New icebreaker question"
              title="New icebreaker"
            >
              <Sparkles size={20} />
            </button>
          }
        />
      ) : null}

      {timeUp && <DecisionSheet state={state} voting={voting} onVote={vote} />}
      {reporting && <ReportSheet onClose={() => setReporting(false)} onReport={report} />}
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
