"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BellRing, ChevronRight, Clock3, Gift, MapPin, SlidersHorizontal, Timer, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISTANCES, getLocation, INTENTS, SEEKING, SPICE_LEVELS } from "@/lib/constants";
import { EXTEND_COST, EXTRA_MASQUERADE_COST, FREE_MASQUERADES_PER_DAY, GIFTS, type Wallet } from "@/lib/keys";
import type { MatchSummary, Profile } from "@/lib/types";
import { Toggle } from "@/components/ui/Toggle";
import { Button, tapFeedback } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS, MaskLineIcon, SpiceIcon } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { Waiting } from "@/components/masquerade/Waiting";
import { MeetSheet } from "./MeetSheet";
import { prefsFromProfile, type SetupPrefs } from "./prefs";

export type HomeStats = { online: number; week_chats: number; week_unmasks: number; gifts_received: number };

export function HomeScreen({
  profile,
  wallet: initialWallet,
  stats,
  matches,
  demoWaiting,
  demoSheet,
}: {
  profile: Profile;
  wallet: Wallet | null;
  stats: HomeStats | null;
  matches: MatchSummary[];
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

  const intent = INTENTS.find((i) => i.value === prefs.intent)!;
  const seeking = SEEKING.find((s) => s.value === prefs.seeking)!;
  const distance = DISTANCES.find((d) => d.value === prefs.maxKm) ?? DISTANCES[1];
  const freeLeft = wallet?.free_left ?? FREE_MASQUERADES_PER_DAY;
  const balance = wallet?.balance ?? 0;
  const nextFree = wallet?.next_free_at && now ? Math.max(0, new Date(wallet.next_free_at).getTime() - now) : null;
  const online = stats?.online ?? 0;

  return (
    <main className="mx-auto max-w-md px-5 pt-5 lg:max-w-6xl lg:px-10 lg:pt-10">
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
          aria-label={`${balance} Keys. Get more`}
        >
          <KeyCoin size={30} /> {balance}
        </Link>
      </header>

      <div className="lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      {/* Masquerade card */}
      <section className="relative mt-5 lg:sticky lg:top-8 lg:col-span-7 lg:mt-0 lg:p-8 overflow-hidden rounded-[30px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-5 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)]">
        <div aria-hidden className="absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-gold/20 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffb5] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7dffb5]" />
            </span>
            {online > 0 ? `${online} ready to mask up near you` : "Be the first to mask up"}
          </span>
          <span className="grid h-12 w-12 shrink-0 animate-float place-items-center rounded-2xl bg-white/15 lg:h-20 lg:w-20 lg:rounded-3xl">
            <MaskIcon className="w-8 text-white lg:w-12" eyes="#6d4ff0" />
          </span>
        </div>
        <h1 className="relative mt-1 font-display text-[28px] leading-tight font-semibold lg:mt-4 lg:text-[44px]">Ready to mask up?</h1>
        <p className="relative mt-1 hidden text-[15px] text-white/80 lg:block">Five minutes with someone new, both masked. Unmask only if you both say yes.</p>

        {/* Summary of choices */}
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setMeetOpen(true);
          }}
          className="relative mt-4 grid w-full grid-cols-2 gap-2 text-left text-[13px]"
          aria-label="Change who you meet"
        >
          <Chip icon={INTENT_ICONS[prefs.intent]({ size: 15 })} text={intent.label} />
          <Chip icon={<Users size={15} />} text={`${seeking.label} · ${prefs.ageMin}–${prefs.ageMax}`} />
          <Chip icon={<MapPin size={15} />} text={distance.value ? `Within ${distance.label}` : "Anywhere"} />
          <Chip icon={<SpiceIcon level={prefs.spice} size={15} />} text={SPICE_LEVELS[prefs.spice].label} />
        </button>
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setMeetOpen(true);
          }}
          className="relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white/90 transition hover:bg-white/10"
        >
          <SlidersHorizontal size={15} /> Change who you meet
        </button>

        <div className="relative mt-1 flex items-center gap-3 rounded-2xl bg-white/12 p-3">
          <BellRing size={19} className="shrink-0" />
          <p className="flex-1 text-[13px] leading-snug">
            <span className="font-semibold">Open to Masquerade</span>
            <br />
            <span className="text-white/75">Pop-ups when someone&apos;s looking for you</span>
          </p>
          <Toggle checked={open} onChange={toggleOpen} label="Open to Masquerade" />
        </div>

        {error && <p className="relative mt-3 rounded-xl bg-white/95 px-4 py-2.5 text-[13px] font-medium text-chili">{error}</p>}
        <Button
          variant="gold"
          size="lg"
          className="relative mt-4"
          onClick={start}
          loading={!!starting}
          loadingText={starting === "location" ? "Finding your location…" : starting === "pass" ? "Using Keys…" : "Masking up…"}
        >
          <MaskLineIcon size={22} strokeWidth={2} /> Put on your mask
        </Button>
        <p className="relative mt-2.5 text-center text-[12px] text-white/80">
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
      {/* Keys power-ups */}
      <div className="mt-7 mb-3 flex items-center justify-between lg:mt-0">
        <h2 className="text-[15px] font-semibold">Use your Keys</h2>
        <Link href="/wallet" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
          Get Keys <ChevronRight size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/wallet" className="rounded-3xl border border-line bg-surface p-4 shadow-card transition active:scale-[0.97]">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-chili-soft text-chili">
            <Gift size={21} strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-[15px] font-semibold">Gifts</p>
          <p className="text-[12px] leading-snug text-muted">Send a little love in any chat · from {GIFTS[0].price} Keys</p>
          <p className="mt-2 text-[20px] tracking-tight">🌹🍸👑💎</p>
        </Link>
        <Link href="/wallet" className="rounded-3xl border border-line bg-surface p-4 shadow-card transition active:scale-[0.97]">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-mint-soft text-mint">
            <Timer size={21} strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-[15px] font-semibold">+2 minutes</p>
          <p className="text-[12px] leading-snug text-muted">Keep a great masked chat going · {EXTEND_COST} Keys</p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-[12px] font-bold text-mint">
            <Clock3 size={13} /> 5:00 → 7:00
          </p>
        </Link>
      </div>

      {/* Your week */}
      <h2 className="mt-7 mb-3 text-[15px] font-semibold">Your week</h2>
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <Stat value={stats?.week_chats ?? 0} label="masked chats" />
        <Stat value={stats?.week_unmasks ?? 0} label="unmasks" />
        <Stat value={stats?.gifts_received ?? 0} label="gifts received" />
      </div>

      {/* Recent matches */}
      {matches.length > 0 && (
        <>
          <div className="mt-7 mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Recent matches</h2>
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
    <span className="flex min-w-0 items-center gap-2 rounded-xl bg-white/12 px-3 py-2.5 font-medium backdrop-blur">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className={clsx("rounded-3xl bg-surface p-3.5 shadow-card")}>
      <p className="font-display text-[26px] font-semibold text-brand">{value}</p>
      <p className="text-[12px] leading-tight text-muted">{label}</p>
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
