"use client";

import { plural, word } from "@/lib/plural";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BellRing, ChevronRight, Gift, MapPin, SlidersHorizontal, Sparkles, Timer, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISTANCES, getLocation, INTENTS, seekingLabel, SPICE_LEVELS } from "@/lib/constants";
import { EXTEND_COST, EXTRA_MASQUERADE_COST, FREE_MASQUERADES_PER_DAY, GIFTS, type Wallet } from "@/lib/keys";
import type { MatchSummary, Profile } from "@/lib/types";
import { Toggle } from "@/components/ui/Toggle";
import { Button, tapFeedback } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS, MaskLineIcon, SpiceIcon } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { useWallet } from "@/components/keys/useWallet";
import { Waiting } from "@/components/masquerade/Waiting";
import { MeetSheet } from "./MeetSheet";
import { NotificationsPrompt } from "@/components/app/Notifications";
import { HomeTabs } from "./HomeTabs";
import { notify } from "@/lib/pushClient";
import { EventCard } from "@/components/events/EventCard";
import type { DashpadEvent } from "@/lib/events";
import { prefsFromProfile, type SetupPrefs } from "./prefs";

export type HomeStats = { online: number; week_chats: number; week_unmasks: number; gifts_received: number };
export type TodayPrompt = { id: string; body: string; answered: boolean; answers: number };

export function HomeScreen({
  profile,
  wallet: initialWallet,
  stats,
  matches,
  nextEvent = null,
  prompt = null,
  demoWaiting,
  demoSheet,
}: {
  profile: Profile;
  wallet: Wallet | null;
  stats: HomeStats | null;
  matches: MatchSummary[];
  nextEvent?: DashpadEvent | null;
  prompt?: TodayPrompt | null;
  demoWaiting?: boolean;
  demoSheet?: "meet" | "keys";
}) {
  const supabase = useMemo(() => createClient(), []);
  const { wallet, refresh } = useWallet(profile.id, initialWallet);
  const [prefs, setPrefs] = useState<SetupPrefs>(() => prefsFromProfile(profile));
  const [open, setOpen] = useState(profile.open_to_masquerade);
  const [meetOpen, setMeetOpen] = useState(demoSheet === "meet");
  const [needKeys, setNeedKeys] = useState(demoSheet === "keys");
  const [waiting, setWaiting] = useState(!!demoWaiting);
  const [starting, setStarting] = useState<null | "location" | "matching" | "pass">(null);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Hello");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Tapped a "someone's masking up" notification: mask up straight away
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("mask") !== "1") return;
    autoStarted.current = true;
    url.searchParams.delete("mask");
    window.history.replaceState(null, "", url.pathname + url.search);
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function savePrefs(extra: Record<string, unknown> = {}) {
    return supabase
      .from("profiles")
      .update({
        pref_intent: prefs.intent,
        pref_seeking: prefs.seeking,
        pref_age_min: prefs.ageMin,
        pref_age_max: prefs.ageMax,
        pref_spice: prefs.spice,
        pref_max_km: prefs.maxKm || null,
        ...extra,
      })
      .eq("id", profile.id);
  }

  async function pickIntent(v: SetupPrefs["intent"]) {
    if (v === prefs.intent) return;
    tapFeedback();
    const before = prefs.intent;
    setPrefs((p) => ({ ...p, intent: v }));
    const { error: err } = await supabase.from("profiles").update({ pref_intent: v }).eq("id", profile.id);
    if (err) setPrefs((p) => ({ ...p, intent: before }));
  }

  async function toggleOpen(v: boolean) {
    tapFeedback();
    setOpen(v);
    const { error: err } = await savePrefs({ open_to_masquerade: v });
    if (err) setOpen(!v);
  }

  async function start() {
    setError(null);
    setStarting("location");
    const loc = await getLocation();
    if (!loc && prefs.maxKm > 0) {
      setStarting(null);
      return setError("Allow location so we can find people near you, or set Distance to Anywhere.");
    }
    setStarting("matching");
    const { data, error: err } = await supabase.rpc("start_masquerade", {
      p_intent: prefs.intent,
      p_seeking: prefs.seeking,
      p_age_min: prefs.ageMin,
      p_age_max: prefs.ageMax,
      p_spice: prefs.spice,
      p_max_km: prefs.maxKm || null,
      p_lat: loc?.lat ?? null,
      p_lng: loc?.lng ?? null,
    });
    if (err) {
      setStarting(null);
      if (err.message.includes("NEEDS_KEYS")) return setNeedKeys(true);
      return setError(err.message || "Couldn't start. Please try again.");
    }
    if (data) window.location.assign(`/masquerade/${data}`);
    else {
      setStarting(null);
      setWaiting(true);
      // Nobody free right now: let people who are open to Masquerade (but away) know
      notify({ kind: "masquerade_wait" });
    }
  }

  async function useKeysAndStart() {
    setStarting("pass");
    const { error: err } = await supabase.rpc("buy_masquerade_pass");
    if (err) {
      setStarting(null);
      setError(err.message.includes("NOT_ENOUGH_KEYS") ? "You need 5 Keys for another masquerade." : "Couldn't use Keys. Please try again.");
      return;
    }
    setNeedKeys(false);
    await refresh();
    await start();
  }

  if (waiting) return <Waiting prefs={prefs} userId={profile.id} onCancel={() => { setWaiting(false); refresh(); }} />;

  const distance = DISTANCES.find((d) => d.value === prefs.maxKm) ?? DISTANCES[1];
  const freeLeft = wallet?.free_left ?? FREE_MASQUERADES_PER_DAY;
  const balance = wallet?.balance ?? 0;
  const hasKeys = balance > 0;
  const nextFree = wallet?.next_free_at && now ? Math.max(0, new Date(wallet.next_free_at).getTime() - now) : null;
  const online = stats?.online ?? 0;

  return (
    <main className="mx-auto max-w-md px-5 pt-5 lg:max-w-6xl lg:px-10 lg:pt-10">
      <HomeTabs className="mb-4" />
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <Link href="/profile" aria-label="Your profile" className="lg:hidden">
          <Avatar src={profile.photos?.[0]} name={profile.display_name} size={46} className="ring-2 ring-surface" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">{greeting}</p>
          <p className="truncate text-[19px] leading-tight font-semibold lg:font-display lg:text-[34px]">{profile.display_name}</p>
        </div>
        <Link
          href="/wallet"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold-soft pr-4 pl-1.5 text-[15px] font-bold text-[#8a5a00] transition active:scale-95"
          aria-label={`${plural(balance, "Key")}. Get more`}
        >
          <KeyCoin size={30} /> {balance}
        </Link>
      </header>

      <div className="lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      {/* Masquerade card */}
      <section className="relative mt-5 lg:sticky lg:top-8 lg:col-span-7 lg:mt-0 lg:p-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-4 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)]">
        <div aria-hidden className="absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full text-gold/20 glow" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffb5] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7dffb5]" />
            </span>
            {online > 0 ? `${online} ready to mask up near you` : "Be the first to mask up"}
          </span>
          <span className="grid h-10 w-10 shrink-0 animate-float place-items-center rounded-xl bg-white/15 lg:h-20 lg:w-20 lg:rounded-3xl">
            <MaskIcon className="w-7 text-white lg:w-12" eyes="#6d4ff0" />
          </span>
        </div>
        <h1 className="relative -mt-1 font-display text-[24px] leading-tight font-semibold lg:mt-4 lg:text-[44px]">Who do you want to talk to?</h1>
        <p className="relative mt-1 hidden text-[15px] text-white/80 lg:block">Five minutes with someone new, both masked. Reveal only if you both want to.</p>

        {/* Mood first */}
        <div role="radiogroup" aria-label="Mood" className="relative mt-3 flex gap-1 rounded-2xl bg-white/12 p-1 lg:mt-5">
          {INTENTS.map((i) => {
            const on = prefs.intent === i.value;
            return (
              <button
                key={i.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickIntent(i.value)}
                className={clsx(
                  "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] lg:text-[14px]",
                  on ? "bg-white text-brand shadow-card" : "text-white/85 hover:bg-white/10",
                )}
              >
                {INTENT_ICONS[i.value]({ size: 15 })}
                {i.value === "spicy" ? "Spicy" : i.label}
              </button>
            );
          })}
        </div>

        {/* The rest of your choices: one tap opens the settings */}
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setMeetOpen(true);
          }}
          className="relative mt-3 flex w-full flex-wrap items-center gap-1.5 text-left text-[12px] lg:mt-5 lg:gap-2 lg:text-[13px]"
          aria-label="Change who you meet"
        >
          {prefs.seeking !== "anyone" && <Chip icon={<Users size={13} />} text={`${seekingLabel(prefs.seeking)} · ${prefs.ageMin}–${prefs.ageMax}`} />}
          <Chip icon={<MapPin size={13} />} text={distance.value ? distance.label : "Anywhere"} />
          <Chip icon={<SpiceIcon level={prefs.spice} size={13} />} text={SPICE_LEVELS[prefs.spice].label} />
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 font-semibold text-brand">
            <SlidersHorizontal size={13} /> Edit
          </span>
        </button>

        <div className="relative mt-3 flex items-center gap-2.5 rounded-2xl bg-white/12 px-3 py-2">
          <BellRing size={16} className="shrink-0" />
          <p className="min-w-0 flex-1 text-[13px] leading-tight">
            <span className="font-semibold">Open to Masquerade</span>
            <span className="hidden text-white/75 sm:inline"> · alerts when someone&apos;s looking, even when you&apos;re away</span>
          </p>
          <Toggle checked={open} onChange={toggleOpen} label="Open to Masquerade" />
        </div>

        {error && <p className="relative mt-3 rounded-xl bg-white/95 px-4 py-2.5 text-[13px] font-medium text-chili">{error}</p>}
        <Button
          variant="gold"
          size="lg"
          className="relative mt-3"
          onClick={start}
          loading={!!starting}
          loadingText={starting === "location" ? "Finding your location…" : starting === "pass" ? "Using Keys…" : "Masking up…"}
        >
          <MaskLineIcon size={22} strokeWidth={2} /> Put on your mask
        </Button>
        <p className="relative mt-2 text-center text-[12px] text-white/80">
          {freeLeft > 0 ? (
            <>
              {freeLeft} of {FREE_MASQUERADES_PER_DAY} free masquerades left today
            </>
          ) : (
            <>
              Next one costs {EXTRA_MASQUERADE_COST} Keys
              {nextFree ? ` · free again in ${formatWait(nextFree)}` : ""}
            </>
          )}
        </p>
      </section>

      <div className="lg:col-span-5">
      {prompt && (
        <Link
          href="/feed"
          onClick={() => tapFeedback()}
          className="mt-6 block rounded-3xl border border-line bg-surface p-4 shadow-card transition active:scale-[0.99] lg:mt-0 lg:mb-7"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-brand uppercase">
              <Sparkles size={14} /> Today&apos;s prompt
            </span>
            <span className="text-[12px] text-muted">{prompt.answers > 0 ? `${prompt.answers} ${word(prompt.answers, "answer")}` : "Be the first"}</span>
          </span>
          <span className="mt-1.5 block font-display text-[20px] leading-snug font-semibold">{prompt.body}</span>
          <span className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">{prompt.answered ? "You answered. See what others said." : "Answer masked to see everyone else's."}</span>
            <span
              className={clsx(
                "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold",
                prompt.answered ? "bg-brand-soft text-brand" : "bg-brand text-white",
              )}
            >
              {prompt.answered ? "See answers" : "Answer"} <ChevronRight size={15} />
            </span>
          </span>
        </Link>
      )}

      {nextEvent && (
        <div className="mt-7 lg:mt-0 lg:mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Upcoming events</h2>
            <Link href="/events" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
              All events <ChevronRight size={16} />
            </Link>
          </div>
          <EventCard event={nextEvent} compact />
        </div>
      )}

      <NotificationsPrompt className="mt-7 lg:mt-0 lg:mb-7" />

      {/* Keys: only for people who have Keys. Shows the balance and what Keys do. */}
      {hasKeys && (
      <section className="mt-7 overflow-hidden rounded-3xl border border-line bg-surface shadow-card lg:mt-0">
        <div className="flex items-center gap-3.5 bg-gradient-to-br from-[#fff3d6] to-[#ffe2a8] px-4 py-4">
          <KeyCoin size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{hasKeys ? "Your Keys" : "Do more with Keys"}</p>
            <p className="text-[13px] text-ink/65">
              {hasKeys ? "Ready to use in any chat" : "Small extras that make a chat special"}
            </p>
          </div>
          {hasKeys && (
            <span className="font-display text-[30px] leading-none font-semibold tabular-nums">{balance.toLocaleString()}</span>
          )}
        </div>

        <ul className="divide-y divide-line px-4">
          <KeyUse
            icon={<Gift size={18} strokeWidth={1.75} />}
            tone="bg-chili-soft text-chili"
            title="Send a gift"
            body="Any chat"
            cost={`from ${GIFTS[0].price}`}
            extra={
              <span className="hidden items-center gap-1 sm:flex">
                {["fire", "jollof", "crown"].map((id) => (
                  <GiftArt key={id} id={id} size={20} />
                ))}
              </span>
            }
          />
          <KeyUse icon={<Timer size={18} strokeWidth={1.75} />} tone="bg-mint-soft text-mint" title="+2 minutes" body="Keep a masked chat going" cost={String(EXTEND_COST)} />
          <KeyUse
            icon={<MaskLineIcon size={18} />}
            tone="bg-brand-soft text-brand"
            title="Extra masquerades"
            body={`After your ${FREE_MASQUERADES_PER_DAY} free ones each day`}
            cost={String(EXTRA_MASQUERADE_COST)}
          />
        </ul>

        <div className="p-4 pt-2">
          <Link
            href="/wallet"
            onClick={() => tapFeedback()}
            className={clsx(
              "flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold transition active:scale-[0.98]",
              hasKeys ? "border border-line-strong bg-surface text-ink hover:bg-cream" : "bg-gold text-ink shadow-[0_8px_20px_-8px_rgb(242_179_61/0.7)]",
            )}
          >
            {hasKeys ? "Top up Keys" : "Get Keys"} <ChevronRight size={17} />
          </Link>
        </div>
      </section>
      )}

      {/* Your week: one slim strip */}
      <section className="mt-6 rounded-2xl bg-surface px-2 py-2.5 shadow-card lg:mt-7">
        <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Your week</p>
        <div className="grid grid-cols-3 divide-x divide-line text-center">
          <Stat value={stats?.week_chats ?? 0} label={`masked ${word(stats?.week_chats ?? 0, "chat")}`} />
          <Stat value={stats?.week_unmasks ?? 0} label={word(stats?.week_unmasks ?? 0, "unmask")} />
          <Stat value={stats?.gifts_received ?? 0} label={word(stats?.gifts_received ?? 0, "gift")} />
        </div>
      </section>

      {/* Recent matches */}
      {matches.length > 0 && (
        <>
          <div className="mt-7 mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Your people</h2>
            <Link href="/matches" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
              See all <ChevronRight size={16} />
            </Link>
          </div>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 py-1.5 no-scrollbar">
            {matches.slice(0, 8).map((m) => (
              <Link key={m.id} href={`/matches/${m.id}`} className="flex w-[64px] shrink-0 flex-col items-center gap-1.5">
                <Avatar src={m.photos?.[0]} name={m.display_name} size={60} className="ring-2 ring-brand ring-offset-2 ring-offset-cream" />
                <span className="w-full truncate text-center text-[12px] font-medium">{m.display_name}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      </div>
      </div>
      <div className="h-4" />

      <MeetSheet
        open={meetOpen}
        onClose={() => {
          setMeetOpen(false);
          savePrefs();
        }}
        prefs={prefs}
        setPrefs={setPrefs}
      />

      <Sheet
        open={needKeys}
        onClose={() => setNeedKeys(false)}
        title="You've used today's free masquerades"
        subtitle={`Everyone gets ${FREE_MASQUERADES_PER_DAY} free every day.${nextFree ? ` Your next free one is in ${formatWait(nextFree)}.` : ""}`}
        icon={<MaskLineIcon size={24} />}
        footer={
          balance >= EXTRA_MASQUERADE_COST ? (
            <Button size="lg" variant="gold" onClick={useKeysAndStart} loading={starting === "pass"} loadingText="Using Keys…">
              <KeyCoin size={22} /> Use {EXTRA_MASQUERADE_COST} Keys and mask up
            </Button>
          ) : (
            <Link href="/wallet" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-ink">
              <KeyCoin size={22} /> Get Keys
            </Link>
          )
        }
      >
        <div className="flex items-center justify-between rounded-2xl bg-gold-soft px-4 py-3">
          <span className="text-[14px] font-medium text-[#8a5a00]">Your balance</span>
          <span className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#8a5a00]">
            <KeyCoin size={20} /> {balance}
          </span>
        </div>
      </Sheet>
    </main>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 font-medium">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-1">
      <p className="font-display text-[20px] leading-tight font-semibold text-brand">{value}</p>
      <p className="truncate text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function formatWait(ms: number) {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function KeyUse({
  icon, tone, title, body, cost, extra,
}: { icon: React.ReactNode; tone: string; title: string; body: string; cost: string; extra?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl " + tone}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="truncate text-[12px] text-muted">{body}</p>
      </div>
      {extra}
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[12px] font-bold text-[#8a5a00]">
        <KeyCoin size={13} /> {cost}
      </span>
    </li>
  );
}
