"use client";

import { plural, word } from "@/lib/plural";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CalendarDays, Clock3, Handshake, MessageCircle, Repeat, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countdown, eventPhase, eventWhen, themeBg, type DashpadEvent } from "@/lib/events";
import { intentLabel } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS, MaskLineIcon } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { PhaseBadge, useNow } from "./EventCard";

function friendly(msg: string | undefined) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("NOT_ENOUGH_KEYS")) return "You don't have enough Keys for this night.";
  if (msg.includes("EVENT_FULL")) return "This night is full.";
  return msg;
}

export function EventLobby({
  event: initial,
  userId,
  autoJoin,
  demo,
}: {
  event: DashpadEvent;
  userId: string;
  autoJoin?: boolean;
  demo?: "waiting";
}) {
  const supabase = useMemo(() => createClient(), []);
  const [e, setE] = useState(initial);
  const [busy, setBusy] = useState<null | "rsvp" | "cancel" | "join">(null);
  const [waiting, setWaiting] = useState(demo === "waiting");
  const [error, setError] = useState<string | null>(null);
  const [waitSecs, setWaitSecs] = useState(0);
  const found = useRef(false);
  const now = useNow();
  const { wallet, refresh: refreshWallet } = useWallet(demo ? null : userId);
  const phase = now ? eventPhase(e, now) : "upcoming";
  const startsIn = now ? new Date(e.starts_at).getTime() - now : 0;
  const endsIn = now ? new Date(e.ends_at).getTime() - now : 0;

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("get_event", { p_event: e.id });
    if (data) setE(data as DashpadEvent);
  }, [supabase, e.id]);

  async function rsvp() {
    setBusy("rsvp");
    setError(null);
    const { data, error: err } = await supabase.rpc("rsvp_event", { p_event: e.id });
    setBusy(null);
    if (err) return setError(friendly(err.message));
    setE(data as DashpadEvent);
    refreshWallet();
  }

  async function unRsvp() {
    if (!confirm("Not going any more?" + (e.entry_keys ? ` Your ${plural(e.entry_keys, "Key")} will be returned.` : ""))) return;
    setBusy("cancel");
    const { data, error: err } = await supabase.rpc("cancel_rsvp", { p_event: e.id });
    setBusy(null);
    if (err) return setError(friendly(err.message));
    setE(data as DashpadEvent);
    refreshWallet();
  }

  const go = useCallback((sid: string) => {
    if (found.current) return;
    found.current = true;
    window.location.assign(`/masquerade/${sid}`);
  }, []);

  const join = useCallback(async () => {
    setBusy("join");
    setError(null);
    const { data, error: err } = await supabase.rpc("join_event_round", { p_event: e.id });
    setBusy(null);
    if (err) return setError(friendly(err.message));
    if (data) go(data as string);
    else {
      setWaitSecs(0);
      setWaiting(true);
    }
  }, [supabase, e.id, go]);

  // Coming back from a round: jump straight into the next one
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoJoin && !autoTried.current && phase === "live" && e.i_am_going) {
      autoTried.current = true;
      join();
    }
  }, [autoJoin, phase, e.i_am_going, join]);

  // While waiting for a partner
  useEffect(() => {
    if (!waiting || demo) return;
    const poll = setInterval(async () => {
      const { data } = await supabase.rpc("poll_masquerade");
      if (data) go(data as string);
    }, 3000);
    const clock = setInterval(() => setWaitSecs((s) => s + 1), 1000);
    const ch = supabase.channel(`event-wait-${userId}-${Math.random().toString(36).slice(2)}`);
    for (const col of ["user_a", "user_b"]) {
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "masquerade_sessions", filter: `${col}=eq.${userId}` }, (p) =>
        go((p.new as { id: string }).id),
      );
    }
    ch.subscribe();
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      supabase.removeChannel(ch);
    };
  }, [waiting, demo, supabase, userId, go]);

  // Stop waiting when the night ends
  useEffect(() => {
    if (phase === "ended" && waiting) {
      setWaiting(false);
      supabase.rpc("cancel_masquerade");
      refresh();
    }
  }, [phase, waiting, supabase, refresh]);

  async function stopWaiting() {
    setWaiting(false);
    await supabase.rpc("cancel_masquerade");
  }

  const canAfford = (wallet?.balance ?? 0) >= e.entry_keys;

  return (
    <main className="mx-auto max-w-md pb-8 lg:max-w-5xl lg:px-10 lg:pt-10">
      {/* Hero */}
      <section className={clsx("relative overflow-hidden bg-gradient-to-br px-5 pt-5 pb-8 text-white lg:rounded-[36px] lg:p-10", themeBg(e.theme))}>
        <div aria-hidden className="absolute -top-16 -right-16 h-56 w-56 animate-blob rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-20 -left-16 h-56 w-56 animate-blob rounded-full bg-black/10 [animation-delay:-6s]" />
        <div className="relative flex items-center justify-between">
          <Link href="/events" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur" aria-label="All events">
            <ArrowLeft size={20} />
          </Link>
          <PhaseBadge phase={phase} startsIn={startsIn} />
        </div>
        <div className="relative mt-6 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">
              <CalendarDays size={13} /> Masquerade Night
            </span>
            <h1 className="mt-3 font-display text-[34px] leading-[1.05] font-semibold lg:text-[48px]">{e.title}</h1>
            <p className="mt-2 text-[15px] text-white/85">{now ? eventWhen(e.starts_at, e.ends_at) : " "}</p>
          </div>
          <MaskIcon className="mt-6 hidden w-28 animate-float text-white/90 lg:block" eyes="transparent" />
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5">{INTENT_ICONS[e.intent]({ size: 13 })} {intentLabel(e.intent)}</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">Ages {e.age_min}–{e.age_max}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5"><Users size={13} /> {e.going_count} going</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5">
            {e.entry_keys > 0 ? <><KeyCoin size={14} /> {plural(e.entry_keys, "Key")}</> : "Free entry"}
          </span>
        </div>
      </section>

      <div className="px-5 lg:mt-8 lg:grid lg:grid-cols-12 lg:gap-8 lg:px-0">
        {/* Main action */}
        <section className="relative z-10 -mt-5 rounded-[28px] bg-surface p-5 shadow-lift lg:col-span-7 lg:mt-0 lg:self-start lg:p-7">
          {phase === "cancelled" && (
            <Center title="This night was cancelled" body={e.entry_keys ? "Any Keys you paid have been returned to you." : "Keep an eye out for the next one."}>
              <ButtonLink href="/events" variant="secondary" size="lg">See other nights</ButtonLink>
            </Center>
          )}

          {phase === "upcoming" && (
            <div className="text-center">
              <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">Starts in</p>
              <p className="mt-1 font-display text-[44px] leading-none font-semibold tabular-nums">{now ? countdown(startsIn) : "…"}</p>
              {e.i_am_going ? (
                <>
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-mint-soft px-4 py-2 text-[14px] font-semibold text-mint">
                    You&apos;re going ✓
                  </p>
                  <p className="mt-3 text-[14px] text-muted">Come back here when it starts — we&apos;ll pair you up straight away.</p>
                  <button onClick={unRsvp} disabled={!!busy} className="mt-4 text-[13px] font-semibold text-muted underline-offset-2 hover:text-chili hover:underline">
                    {busy === "cancel" ? "Updating…" : "I can't make it"}
                  </button>
                </>
              ) : (
                <RsvpButton e={e} busy={busy === "rsvp"} canAfford={canAfford} onRsvp={rsvp} />
              )}
            </div>
          )}

          {phase === "live" && !e.i_am_going && (
            <div className="text-center">
              <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-chili">
                <span className="h-2 w-2 animate-pulse rounded-full bg-chili" /> Happening now · {now ? countdown(endsIn) : ""} left
              </p>
              <p className="mt-2 text-[15px] text-muted">It&apos;s not too late — join and you&apos;ll be in the next round.</p>
              <RsvpButton e={e} busy={busy === "rsvp"} canAfford={canAfford} onRsvp={rsvp} label="Join tonight" />
            </div>
          )}

          {phase === "live" && e.i_am_going && !waiting && (
            <div className="text-center">
              <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-chili">
                <span className="h-2 w-2 animate-pulse rounded-full bg-chili" /> Live · {now ? countdown(endsIn) : ""} left
              </p>
              <p className="mt-3 font-display text-[30px] leading-tight font-semibold">Round {e.my_rounds + 1}</p>
              <p className="mt-1 text-[15px] text-muted">
                {e.my_rounds ? "Ready for someone new?" : "Five minutes, masked, with someone here tonight."}
              </p>
              <Button variant="gold" size="lg" className="mt-5" onClick={join} loading={busy === "join"} loadingText="Masking up…">
                <MaskLineIcon size={22} strokeWidth={2} /> {e.my_rounds ? "Next round" : "Start my first round"}
              </Button>
            </div>
          )}

          {phase === "live" && e.i_am_going && waiting && (
            <div className="py-2 text-center">
              <div className="relative mx-auto grid h-32 w-32 place-items-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand/25" />
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand/20 [animation-delay:1.1s]" />
                <span className="relative grid h-20 w-20 animate-float place-items-center rounded-full bg-brand text-white shadow-lift">
                  <MaskIcon className="w-12" eyes="#5b3fd9" />
                </span>
              </div>
              <p className="mt-5 font-display text-[24px] font-semibold">Finding your next partner…</p>
              <p className="mt-1 text-[14px] text-muted tabular-nums">
                {waitSecs < 45 ? "People finish rounds every few minutes" : "Hang tight — someone will be free soon"} · {Math.floor(waitSecs / 60)}:{String(waitSecs % 60).padStart(2, "0")}
              </p>
              <Button variant="secondary" size="lg" className="mt-6" onClick={stopWaiting}>Take a break</Button>
            </div>
          )}

          {phase === "ended" && (
            <Center
              title={e.i_am_going ? "That's a wrap!" : "This night has ended"}
              body={
                e.i_am_going
                  ? `You met ${e.my_rounds} ${e.my_rounds === 1 ? "person" : "people"} · ${e.my_unmasks} mutual unmask${e.my_unmasks === 1 ? "" : "s"}`
                  : "Look out for the next Masquerade Night."
              }
            >
              {e.my_unmasks > 0 ? (
                <ButtonLink href="/matches" size="lg"><MessageCircle size={18} /> See your matches</ButtonLink>
              ) : (
                <ButtonLink href="/events" variant="secondary" size="lg">See other nights</ButtonLink>
              )}
            </Center>
          )}
          {error && <p className="mt-4 rounded-xl bg-chili-soft px-4 py-2.5 text-center text-[14px] font-medium text-chili">{error}</p>}
        </section>

        {/* Details */}
        <aside className="mt-6 space-y-4 lg:col-span-5 lg:mt-0">
          {(e.my_rounds > 0 || phase === "live") && e.i_am_going && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-3xl bg-surface p-4 shadow-card">
                <p className="font-display text-[28px] font-semibold text-brand">{e.my_rounds}</p>
                <p className="text-[12px] text-muted">{word(e.my_rounds, "round")} tonight</p>
              </div>
              <div className="rounded-3xl bg-surface p-4 shadow-card">
                <p className="font-display text-[28px] font-semibold text-[#c2306b]">{e.my_unmasks}</p>
                <p className="text-[12px] text-muted">mutual {word(e.my_unmasks, "unmask")}</p>
              </div>
            </div>
          )}
          {e.description && (
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">About tonight</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{e.description}</p>
            </div>
          )}
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">How it works</h2>
            <ul className="mt-3 space-y-3 text-[14px]">
              <Li icon={<Clock3 size={16} />} text="Each round is a 5-minute masked chat with icebreakers made for tonight." />
              <Li icon={<Handshake size={16} />} text="Both unmask? You're connected. If not, the chat disappears." />
              <Li icon={<Repeat size={16} />} text="Then a new person — you'll never meet the same one twice tonight." />
              <Li icon={<Sparkles size={16} />} text="Rounds don't use your 5 free daily masquerades." />
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function RsvpButton({ e, busy, canAfford, onRsvp, label }: { e: DashpadEvent; busy: boolean; canAfford: boolean; onRsvp: () => void; label?: string }) {
  if (e.entry_keys > 0 && !canAfford) {
    return (
      <div className="mt-5">
        <ButtonLink href="/wallet" variant="gold" size="lg">
          <KeyCoin size={22} /> Get Keys to join · {e.entry_keys}
        </ButtonLink>
        <p className="mt-2 text-[13px] text-muted">Entry is {plural(e.entry_keys, "Key")}.</p>
      </div>
    );
  }
  return (
    <Button size="lg" className="mt-5" onClick={onRsvp} loading={busy} loadingText="Saving your spot…">
      {label ?? "I'm going"} {e.entry_keys > 0 ? `· ${plural(e.entry_keys, "Key")}` : "· Free"}
    </Button>
  );
}

function Center({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <MaskIcon className="mx-auto w-14 text-brand" eyes="#fff" />
      <p className="mt-3 font-display text-[26px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-muted">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Li({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <span className="pt-1 leading-snug text-ink-soft">{text}</span>
    </li>
  );
}
