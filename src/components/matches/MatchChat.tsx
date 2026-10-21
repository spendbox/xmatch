"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, Gift, MoreVertical, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ageFromBirthdate } from "@/lib/constants";
import type { ChatMessage, Profile } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { ReportSheet } from "@/components/masquerade/ReportSheet";
import { ProfileSheet } from "./ProfileSheet";

export function MatchChat({
  matchId,
  myId,
  other,
  initialMessages,
}: {
  matchId: string;
  myId: string;
  other: Profile;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [menu, setMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const age = ageFromBirthdate(other.birthdate);

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

  async function send(text: string) {
    const temp: ChatMessage = { id: -Date.now(), sender_id: myId, body: text, created_at: new Date().toISOString() };
    setMessages((l) => [...l, temp]);
    const { data } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: myId, body: text })
      .select("id, sender_id, body, created_at")
      .single();
    setMessages((l) => {
      const without = l.filter((m) => m.id !== temp.id);
      if (!data) return without;
      return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage];
    });
  }

  async function report(reason: string) {
    await supabase.rpc("report_match", { p_match: matchId, p_reason: reason });
    router.replace("/matches");
    router.refresh();
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-cream">
      <header className="flex items-center gap-2 border-b border-line bg-surface/95 px-2 py-2.5 backdrop-blur">
        <Link href="/matches" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Back to matches">
          <ArrowLeft size={22} />
        </Link>
        <button onClick={() => setShowProfile(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar src={other.photos?.[0]} name={other.display_name} size={42} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">
              {other.display_name}
              {age ? `, ${age}` : ""}
            </p>
            <p className="text-[12px] text-muted">View profile</p>
          </div>
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
            {menu ? <X size={20} /> : <MoreVertical size={20} />}
          </button>
          {menu && (
            <div className="absolute top-11 right-0 z-20 w-52 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-fade-up">
              <button onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-chili hover:bg-chili-soft">
                <Flag size={18} /> Report & unmatch
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <p className="px-8 pt-10 text-center text-[15px] text-muted">You unmasked each other. Say hi to {other.display_name}!</p>
        )}
        <MessageList messages={messages} myId={myId} />
      </div>

      <Composer
        onSend={send}
        placeholder={`Message ${other.display_name}`}
        leading={
          <button
            type="button"
            onClick={() => setToast("Gifts are coming soon 🎁")}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-chili-soft text-chili"
            aria-label="Send a gift"
          >
            <Gift size={20} />
          </button>
        }
      />

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift animate-fade-up">
          {toast}
        </div>
      )}
      {showProfile && <ProfileSheet profile={other} onClose={() => setShowProfile(false)} />}
      {reporting && <ReportSheet onClose={() => setReporting(false)} onReport={report} />}
    </div>
  );
}
