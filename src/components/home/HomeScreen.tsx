"use client";

import { word } from "@/lib/plural";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Gift, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GIFTS, REOPEN_COST, type Wallet } from "@/lib/keys";
import type { MasqueradeHour } from "@/lib/hourly";
import type { MatchSummary, Profile } from "@/lib/types";
import { tapFeedback } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { useWallet } from "@/components/keys/useWallet";
import { NotificationsPrompt } from "@/components/app/Notifications";
import { EventCard } from "@/components/events/EventCard";
import type { DashpadEvent } from "@/lib/events";
import { MeetSheet } from "./MeetSheet";
import { MasqueradeCard, useMasqueradeHour } from "./MasqueradeCard";
import { PastPairs } from "./PastPairs";
import { PlacePicker } from "./PlacePicker";
import { intentLabel } from "@/lib/constants";
import { INTENT_ICONS } from "@/components/ui/icons";
import { prefsFromProfile, type SetupPrefs } from "./prefs";

export type HomeStats = { online: number; week_chats: number; week_unmasks: number; gifts_received: number };

export function HomeScreen({
  profile,
  wallet: initialWallet,
  stats,
  matches,
  nextEvent = null,
  hour: initialHour = null,
  demoSheet,
}: {
  profile: Profile;
  wallet: Wallet | null;
  stats: HomeStats | null;
  matches: MatchSummary[];
  nextEvent?: DashpadEvent | null;
  hour?: MasqueradeHour | null;
  demoSheet?: "meet";
}) {
  const supabase = useMemo(() => createClient(), []);
  const { wallet } = useWallet(profile.id, initialWallet);
  const [prefs, setPrefs] = useState<SetupPrefs>(() => prefsFromProfile(profile));
  const [meetOpen, setMeetOpen] = useState(demoSheet === "meet");
  const [greeting, setGreeting] = useState("Hello");
  const ctl = useMasqueradeHour(profile.id, initialHour);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [place, setPlace] = useState({ country: profile.place_country ?? null, region: profile.place_region ?? null, label: profile.place_label ?? null });

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  function savePrefs() {
    return supabase
      .from("profiles")
      .update({
        pref_intent: prefs.intent,
        pref_seeking: prefs.seeking,
        pref_age_min: prefs.ageMin,
        pref_age_max: prefs.ageMax,
        pref_spice: prefs.spice,
        // Distance is decided for you now (closest first)
        pref_max_km: null,
      })
      .eq("id", profile.id);
  }

  const balance = wallet?.balance ?? 0;
  const hasKeys = balance > 0;

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
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setMeetOpen(true);
          }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand/20 bg-brand-soft text-brand transition active:scale-95"
          aria-label={`Your Masquerade settings: ${intentLabel(prefs.intent)}`}
          title={`${intentLabel(prefs.intent)} · Masquerade settings`}
        >
          {INTENT_ICONS[prefs.intent]({ size: 20, strokeWidth: 2 })}
        </button>
        <Link
          href="/wallet"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold-soft pr-4 pl-1.5 text-[15px] font-bold text-[#8a5a00] transition active:scale-95"
          aria-label={`${balance} Keys. Get more`}
        >
          <KeyCoin size={30} /> {balance}
        </Link>
      </header>

      <div className="lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      <div className="mt-5 lg:sticky lg:top-8 lg:col-span-7 lg:mt-0">
        <MasqueradeCard userId={profile.id} ctl={ctl} hasPlace={!!place.country} onPlace={() => setPlaceOpen(true)} />
      </div>

      <div className="lg:col-span-5">
      <PastPairs pairs={ctl.hour?.past ?? []} balance={wallet?.balance ?? null} onChanged={ctl.load} />

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
          <KeyUse icon={<RotateCcw size={18} strokeWidth={1.75} />} tone="bg-brand-soft text-brand" title="Reopen a past pair" body="Pick up a chat the hour cut short" cost={String(REOPEN_COST)} />
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
        place={place.label}
        onPlace={() => setPlaceOpen(true)}
      />

      <PlacePicker
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        userId={profile.id}
        current={place}
        onSaved={(p) => setPlace({ country: p.country, region: p.region, label: p.label })}
      />
    </main>
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
