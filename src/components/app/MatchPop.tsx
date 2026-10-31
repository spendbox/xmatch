"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Heart, Smile, Star, Wine, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCall } from "@/components/calls/CallProvider";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Photo } from "@/components/ui/Photo";
import { tapFeedback } from "@/components/ui/Button";
import type { Intent, MatchSummary } from "@/lib/types";

/**
 * What popped:
 * - pair: Masquerade just paired you with someone (masked, the timer is running)
 * - match: you've both unmasked (or waved back), so you're connected
 */
export type MatchPopData = {
  /** ice: they answered your icebreaker */
  kind: "pair" | "match" | "ice";
  intent: Intent;
  /** Their mask name (pair) or real name (match) */
  name: string;
  photo?: string | null;
  personId?: string;
  href: string;
  /** Your own photo, beside theirs when you match */
  myPhoto?: string | null;
  myId?: string;
};

type Theme = {
  bg: string;
  button: string;
  floaty: (size: number) => React.ReactNode;
  icon: React.ReactNode;
  pair: { title: string; body: (n: string) => string; cta: string };
  match: { title: string; body: (n: string) => string; cta: string };
  ice: { title: string; body: (n: string) => string; cta: string };
};

/** Each mood gets its own look and words */
export const MATCH_THEMES: Record<Intent, Theme> = {
  friends: {
    bg: "linear-gradient(160deg, #0f7a55 0%, #1f9d6b 45%, #f2b33d 100%)",
    button: "#0f7a55",
    floaty: (s) => (s % 2 ? <Smile size={s} /> : <Star size={s} />),
    icon: <Smile size={40} strokeWidth={2} />,
    pair: { title: "New friend incoming!", body: (n) => `${n} is up for a chat. Say hi before the timer runs out.`, cta: "Say hi" },
    match: { title: "Friends unlocked!", body: (n) => `You and ${n} both unmasked. Keep the conversation going.`, cta: "Open your chat" },
    ice: { title: "The ice is broken!", body: (n) => `${n} answered your icebreaker. Your masked chat is open, so say hi.`, cta: "Say hi" },
  },
  dating: {
    bg: "linear-gradient(160deg, #3b1fa8 0%, #8f3fd9 50%, #e0477e 100%)",
    button: "#8f3fd9",
    floaty: (s) => <Heart size={s} fill="currentColor" />,
    icon: <Wine size={40} strokeWidth={2} />,
    pair: { title: "Your date has arrived", body: (n) => `${n} is waiting, masked. Make a good first impression.`, cta: "Start chatting" },
    match: { title: "You clicked!", body: (n) => `You and ${n} unmasked each other. Your chat is waiting.`, cta: "Open your chat" },
    ice: { title: `They answered!`, body: (n) => `${n} answered your icebreaker. Your masked chat is open. Make it count.`, cta: "Open the chat" },
  },
  spicy: {
    bg: "linear-gradient(160deg, #1c0610 0%, #8a1030 50%, #ff5a36 100%)",
    button: "#c21f3a",
    floaty: (s) => <Flame size={s} fill="currentColor" />,
    icon: <Flame size={40} strokeWidth={2} />,
    pair: { title: "Things just got spicy", body: (n) => `${n} is here and in the mood to flirt.`, cta: "Turn up the heat" },
    match: { title: "Sparks flew!", body: (n) => `You and ${n} unmasked. Take it from here.`, cta: "Open your chat" },
    ice: { title: "The ice melted 🔥", body: (n) => `${n} answered your icebreaker. Your masked chat is open. Take it from here.`, cta: "Open the chat" },
  },
};

/**
 * A full-screen pop-up wherever you are in Dashpad when you're paired (Masquerade) or when you
 * connect with someone. Not shown on that chat's own page (it has its own), or during a call
 * (it waits until the call ends).
 */
export function MatchPop({ userId, myPhoto }: { userId: string; myPhoto?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const path = usePathname();
  const router = useRouter();
  const onCall = !!useCall().call;
  const [queue, setQueue] = useState<MatchPopData[]>([]);
  const here = useRef(path);
  here.current = path;

  useEffect(() => {
    const shown = (key: string) => {
      try {
        if (sessionStorage.getItem(key)) return true;
        sessionStorage.setItem(key, "1");
      } catch {}
      return false;
    };
    const add = (p: MatchPopData) => setQueue((q) => (q.some((x) => x.href === p.href) ? q : [...q, p]));

    // Paired by Masquerade (live pairing): you didn't start it, so it's news
    type SessionRow = { id: string; user_a: string; alias_a: string; alias_b: string; intent: Intent; hour_at: string | null; reopened_at: string | null; status: string };
    const onSession = (row: SessionRow) => {
      if (!row?.hour_at || row.reopened_at || row.status !== "active") return;
      const href = `/masquerade/${row.id}`;
      if (here.current === href || shown(`dp_pop_${row.id}`)) return;
      add({ kind: "pair", intent: row.intent, name: row.user_a === userId ? row.alias_b : row.alias_a, href });
    };

    // Connected: both unmasked, or a wave back
    type MatchRow = { id: string; session_id: string | null; intent: Intent };
    const onMatch = async (row: MatchRow) => {
      if (!row?.id) return;
      const href = `/matches/${row.id}`;
      // Already watching it happen in that chat
      if (here.current === href || (row.session_id && here.current === `/masquerade/${row.session_id}`)) return;
      if (shown(`dp_pop_${row.id}`)) return;
      // Their name and unlocked photo (the originals, now you're connected). Tried twice, in case it's not there yet.
      let m: MatchSummary | undefined;
      for (let i = 0; i < 2 && !m; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1200));
        const { data } = await supabase.rpc("get_matches");
        m = (Array.isArray(data) ? (data as MatchSummary[]) : []).find((x) => x.id === row.id);
      }
      add({ kind: "match", intent: row.intent ?? "dating", name: m?.display_name ?? "your match", photo: m?.photos?.[0], personId: m?.other_id, href, myPhoto, myId: userId });
    };

    // They answered your icebreaker: your masked chat just opened
    type IceRow = { id: string; status: string; session_id: string | null; to_user: string };
    const onIce = async (row: IceRow) => {
      if (row?.status !== "answered" || !row.session_id) return;
      const href = `/masquerade/${row.session_id}`;
      if (here.current === href || shown(`dp_pop_${row.session_id}`)) return;
      const [{ data: s }, { data: mine }] = await Promise.all([
        supabase.from("masquerade_sessions").select("intent").eq("id", row.session_id).maybeSingle(),
        supabase.rpc("my_ice_breaks"),
      ]);
      const sent = ((mine as { sent?: { id: string; name: string | null }[] } | null)?.sent ?? []).find((x) => x.id === row.id);
      add({ kind: "ice", intent: ((s as { intent?: Intent } | null)?.intent ?? "dating") as Intent, name: sent?.name?.split(" ")[0] ?? "They", href });
    };

    const ch = supabase
      .channel(`match-pop-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "masquerade_sessions", filter: `user_a=eq.${userId}` }, (p) => onSession(p.new as SessionRow))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "masquerade_sessions", filter: `user_b=eq.${userId}` }, (p) => onSession(p.new as SessionRow))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, (p) => void onMatch(p.new as MatchRow))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, (p) => void onMatch(p.new as MatchRow))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ice_breaks", filter: `from_user=eq.${userId}` }, (p) => void onIce(p.new as IceRow))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, userId, myPhoto]);

  const pop = queue[0];
  // Went to that chat some other way: no need to show it
  useEffect(() => {
    if (pop && path === pop.href) setQueue((q) => q.slice(1));
  }, [path, pop]);

  if (!pop || onCall) return null;
  return (
    <MatchPopView
      pop={pop}
      onOpen={() => {
        tapFeedback();
        setQueue((q) => q.slice(1));
        router.push(pop.href);
      }}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
}

/** The pop-up itself (also used by design previews) */
export function MatchPopView({ pop, onOpen, onClose }: { pop: MatchPopData; onOpen: () => void; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;
  const t = MATCH_THEMES[pop.intent] ?? MATCH_THEMES.dating;
  const words = pop.kind === "pair" ? t.pair : pop.kind === "ice" ? t.ice : t.match;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={words.title} className="fixed inset-0 z-[90] grid animate-fade-in place-items-center overflow-hidden p-6 text-white" style={{ background: t.bg }}>
      <style>{`@keyframes dp-match-float{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.9}100%{transform:translateY(-105vh) scale(1.1);opacity:0}}.dp-match-float{animation:dp-match-float 4.2s ease-in infinite}`}</style>
      {/* Hearts, flames or smiles drifting up */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="dp-match-float absolute -bottom-10 text-white/35" style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i * 0.29) % 4.2}s` }}>
            {t.floaty(18 + ((i * 7) % 20))}
          </span>
        ))}
      </div>

      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid h-11 w-11 place-items-center rounded-full bg-black/20 text-white backdrop-blur">
        <X size={22} />
      </button>

      <div className="relative w-full max-w-sm animate-pop text-center">
        {/* A pair: their mask with the mood. A match: the two of you, side by side, their photo unlocked */}
        <div className="mx-auto flex items-center justify-center">
          {pop.kind === "match" ? (
            <div className="relative flex items-center">
              <span className="relative h-28 w-28 -rotate-6 overflow-hidden rounded-full bg-white/20 shadow-2xl ring-4 ring-white">
                {pop.myPhoto ? (
                  <Photo src={pop.myPhoto} id={pop.myId} small={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center"><MaskIcon className="w-14 text-white" eyes="transparent" /></span>
                )}
              </span>
              <span className="relative -ml-6 h-32 w-32 rotate-6 overflow-hidden rounded-full bg-white/20 shadow-2xl ring-4 ring-white">
                {pop.photo ? (
                  <Photo src={pop.photo} id={pop.personId} small={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center"><MaskIcon className="w-14 text-white" eyes="transparent" /></span>
                )}
              </span>
              {/* The mood, where the two photos meet */}
              <span className="absolute -bottom-2 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-white shadow-lift" style={{ color: t.button }}>
                {pop.intent === "friends" ? <Smile size={24} strokeWidth={2.4} /> : pop.intent === "spicy" ? <Flame size={24} fill="currentColor" /> : <Heart size={24} fill="currentColor" />}
              </span>
            </div>
          ) : (
            <span className="relative grid h-28 w-28 place-items-center rounded-full bg-white/15 ring-4 ring-white/40 shadow-2xl">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/15 [animation-duration:2.2s]" />
              {pop.kind === "pair" || pop.kind === "ice" ? <MaskIcon className="relative w-16 text-white" eyes="transparent" /> : t.icon}
            </span>
          )}
        </div>
        <span className={(pop.kind === "match" ? "mt-8" : "mt-5") + " inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-bold tracking-wide uppercase"}>
          {pop.intent === "friends" ? <Smile size={14} /> : pop.intent === "spicy" ? <Flame size={14} /> : <Heart size={14} />}
          {pop.kind === "pair" ? "You've been paired" : pop.kind === "ice" ? "Icebreaker answered" : "It's a match"}
        </span>
        <h2 className="mt-3 font-display text-[40px] leading-[1.02] font-semibold [text-wrap:balance]">{words.title}</h2>
        <p className="mx-auto mt-3 max-w-[300px] text-[16px] leading-relaxed text-white/90">{words.body(pop.name)}</p>
        <div className="mt-8 grid gap-2.5">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-white text-[16px] font-bold shadow-lift transition active:scale-[0.98]"
            style={{ color: t.button }}
          >
            {words.cta}
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-white/90 hover:bg-white/10">
            Later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
