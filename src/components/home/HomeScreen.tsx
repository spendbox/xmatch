"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sticky } from "@/components/ui/Sticky";
import { PeopleForYou } from "./PeopleForYou";
import { WelcomeTour } from "./WelcomeTour";
import { GettingStarted } from "./GettingStarted";
import type { Thing } from "@/lib/things";
import type { ExploreList, Viewers } from "@/lib/explore";
import { ChevronRight } from "lucide-react";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { createClient } from "@/lib/supabase/client";
import type { Wallet } from "@/lib/keys";
import type { MasqueradeHour } from "@/lib/hourly";
import type { MatchSummary, Profile } from "@/lib/types";
import { tapFeedback } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { EventCard } from "@/components/events/EventCard";
import { PactCard, type PactListItem } from "@/components/pacts/PactCard";
import type { DashpadEvent } from "@/lib/events";
import { MeetSheet } from "./MeetSheet";
import { MasqueradeCard, useMasqueradeHour } from "./MasqueradeCard";
import { PastPairs } from "./PastPairs";
import { PlacePicker } from "./PlacePicker";
import { intentLabel } from "@/lib/constants";
import { INTENT_ICONS } from "@/components/ui/icons";
import { prefsFromProfile, type SetupPrefs } from "./prefs";
import type { MeetList } from "@/lib/meets";
import { useNow } from "@/components/events/EventCard";
import { MeetCard } from "@/components/meets/MeetCard";
import { MeetFab } from "@/components/meets/MeetFab";
import { PostMeetSheet } from "@/components/meets/PostMeetSheet";
import { YourMeet } from "@/components/meets/YourMeet";
import { useMeets } from "@/components/meets/useMeets";
import { FEATURES } from "@/lib/features";
import { ProfileViews } from "./ProfileViews";
import { RecentChats, type RecentMasked } from "./RecentChats";

export type HomeStats = { online: number; week_chats: number; week_unmasks: number; gifts_received: number };

export function HomeScreen({
  profile,
  wallet: initialWallet,
  nextEvent = null,
  pact = null,
  hour: initialHour = null,
  meets: initialMeets = null,
  demoSheet,
  demoPeople,
  demoViews,
  demoMasked,
  matches = [],
  demoSetup,
  demoTour,
}: {
  profile: Profile;
  wallet: Wallet | null;
  /** Not shown on Home any more (stats live on Profile) */
  stats?: HomeStats | null;
  /** Your chats: the latest show as circles at the top */
  matches?: MatchSummary[];
  nextEvent?: DashpadEvent | null;
  pact?: PactListItem | null;
  hour?: MasqueradeHour | null;
  meets?: MeetList | null;
  demoSheet?: "meet" | "post";
  /** Design previews: the people grid */
  demoPeople?: ExploreList;
  /** Design previews: who viewed you */
  demoViews?: Viewers;
  /** Design previews: masked chats in Recent chats */
  demoMasked?: RecentMasked[];
  demoSetup?: { place: boolean; push: boolean; things: number; claimed: boolean; reward: number };
  /** Design previews: open the welcome tour */
  demoTour?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { wallet, refresh: refreshWallet } = useWallet(profile.id, initialWallet);
  const { list: meets, refresh: refreshMeets } = useMeets(initialMeets, { off: !FEATURES.meets });
  const [postOpen, setPostOpen] = useState(demoSheet === "post");
  const now = useNow(30_000);
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

  async function savePrefs(next: SetupPrefs) {
    const before = prefs;
    setPrefs(next);
    // The save only goes out when it's awaited (this was missing, so changes never reached Dashpad)
    const { error } = await supabase
      .from("profiles")
      .update({
        pref_intent: next.intent,
        pref_seeking: next.seeking,
        pref_age_min: next.ageMin,
        pref_age_max: next.ageMax,
        pref_spice: next.spice,
        // Distance is decided for you now (closest first)
        pref_max_km: null,
      })
      .eq("id", profile.id);
    if (error) {
      setPrefs(before);
      alert("Couldn't save your Masquerade settings. Check your connection and try again.");
    }
  }

  const balance = wallet?.balance ?? 0;
  const hasKeys = balance > 0;

  return (
    <main className="mx-auto max-w-md px-5 pt-2.5 lg:max-w-6xl lg:px-10 lg:pt-8">
      {/* Top bar: stays at the top while you scroll */}
      <Sticky>
      <header className="flex items-center gap-3">
        <span className="relative shrink-0 lg:hidden">
          <Link href="/profile" aria-label="Your profile" className="block">
            <Avatar src={profile.photos?.[0]} name={profile.display_name} size={46} className="ring-2 ring-surface" />
          </Link>
          {/* Small badge on the photo: your Masquerade mood; tap it to change settings */}
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setMeetOpen(true);
            }}
            className="absolute -right-1 -bottom-1 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-cream bg-brand text-white shadow-sm"
            aria-label={`Your Masquerade settings: ${intentLabel(prefs.intent)}`}
            title={`${intentLabel(prefs.intent)} · Masquerade settings`}
          >
            {INTENT_ICONS[prefs.intent]({ size: 11, strokeWidth: 2.5 })}
          </button>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">{greeting}</p>
          <p className="truncate text-[19px] leading-tight font-semibold lg:font-display lg:text-[34px]">{profile.display_name}</p>
        </div>
        <FeedbackButton />
        <Link
          href="/wallet"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold-soft pr-4 pl-1.5 text-[15px] font-bold text-[#8a5a00] transition active:scale-95"
          aria-label={`${balance} Keys. Get more`}
        >
          <KeyCoin size={30} /> {balance}
        </Link>
      </header>
      </Sticky>

      <RecentChats matches={matches} myId={profile.id} demoMasked={demoMasked} />
      <ProfileViews demo={demoViews} onKeys={refreshWallet} />

      <div className="lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      <div className="mt-5 lg:col-span-7 lg:mt-0">
        <MasqueradeCard userId={profile.id} ctl={ctl} prefs={prefs} onSettings={() => setMeetOpen(true)} />

        {pact && (
          <section className="mt-6">
            <h2 className="mb-3 text-[15px] font-semibold">Link-Up open now</h2>
            <PactCard pact={pact} compact />
          </section>
        )}

        <GettingStarted
          hasPlace={!!place.country}
          onPlace={() => setPlaceOpen(true)}
          things={(profile.things as Thing[] | undefined) ?? []}
          onKeys={refreshWallet}
          demo={demoSetup}
        />

      </div>

      {/* On computers: people, past pairs and events in the right column (same order as on phones) */}
      <div className="lg:col-span-5">
        <PeopleForYou userId={profile.id} demo={demoPeople} />
        <WelcomeTour force={demoTour} off={!!demoPeople && !demoTour} />
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

      {FEATURES.meets && meets && (meets.mine || meets.posts.length > 0) && (
        <section className="mt-7 lg:mt-0 lg:mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Meets for you</h2>
            <Link href="/meet" className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
              View more <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid gap-3">
            {meets.mine && <YourMeet meet={meets.mine} now={now} href="/meet" />}
            {meets.posts.slice(0, 3).map((m) => (
              <MeetCard key={m.id} meet={m} now={now} />
            ))}
          </div>
        </section>
      )}

      </div>
      </div>
      <div className="h-4" />

      <MeetSheet
        open={meetOpen}
        onClose={() => setMeetOpen(false)}
        onSave={(next) => {
          setMeetOpen(false);
          void savePrefs(next);
        }}
        prefs={prefs}
        place={place.label}
        onPlace={() => setPlaceOpen(true)}
      />

      {FEATURES.meets && <MeetFab free={meets?.cost === 0} onOpen={() => setPostOpen(true)} />}
      <PostMeetSheet
        open={FEATURES.meets && postOpen}
        onClose={() => setPostOpen(false)}
        prefs={prefs}
        place={place.label}
        cost={meets?.cost ?? 0}
        hours={meets?.hours ?? 3}
        onEditSettings={() => {
          setPostOpen(false);
          setMeetOpen(true);
        }}
        onPosted={() => {
          setPostOpen(false);
          refreshMeets();
          refreshWallet();
        }}
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

