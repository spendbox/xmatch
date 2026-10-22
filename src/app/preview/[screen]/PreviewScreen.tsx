"use client";

import { HomeScreen } from "@/components/home/HomeScreen";
import { WalletScreen } from "@/components/keys/WalletScreen";
import { GiftSheet } from "@/components/keys/GiftSheet";
import { EventsScreen } from "@/components/events/EventsScreen";
import { EventMediaProvider } from "@/components/events/media/EventMediaProvider";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { AuthFlow } from "@/app/(auth)/AuthFlow";
import { MembersList } from "@/components/admin/MembersList";
import { MemberDetail } from "@/components/admin/MemberDetail";
import { EventSpace } from "@/components/events/space/EventSpace";
import { EventLobby } from "@/components/events/EventLobby";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { NightsList, type AdminNight } from "@/components/admin/NightsList";
import { NightEditor } from "@/components/admin/NightEditor";
import { IcebreakerManager } from "@/components/admin/IcebreakerManager";
import type { DashpadEvent } from "@/lib/events";
import { MasqueradeRoom } from "@/components/masquerade/MasqueradeRoom";
import { Outcome } from "@/components/masquerade/Outcome";
import { MatchesList } from "@/components/matches/MatchesList";
import { MatchChat } from "@/components/matches/MatchChat";
import { ProfileSheet } from "@/components/matches/ProfileSheet";
import { CallScreen } from "@/components/calls/CallScreen";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { BottomNav } from "@/components/app/BottomNav";
import { Sidebar } from "@/components/app/Sidebar";
import { InviteSheet } from "@/components/app/InviteSheet";
import { Onboarding } from "@/app/onboarding/Onboarding";
import { Button } from "@/components/ui/Button";
import { InterestPicker } from "@/components/profile/InterestPicker";
import { FeedScreen } from "@/components/feed/FeedScreen";
import { PlacePicker } from "@/components/home/PlacePicker";
import { YourPeople } from "@/components/matches/YourPeople";
import { PricesManager } from "@/components/admin/PricesManager";
import { MasqueradeHealth } from "@/components/admin/MasqueradeHealth";
import { FeedChat } from "@/components/feed/FeedChat";
import { PromptManager } from "@/components/admin/PromptManager";
import { PromptAnswers } from "@/components/admin/PromptAnswers";
import type { Feed, FeedAnswer, FeedGift } from "@/lib/feed";
import type { MasqueradeHour } from "@/lib/hourly";
import type { ChatMessage, MasqueradeState, Profile } from "@/lib/types";

const photo = (a: string, b: string, letter: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="200" cy="190" r="80" fill="#fff" opacity=".35"/><rect x="90" y="300" width="220" height="200" rx="110" fill="#fff" opacity=".35"/><text x="200" y="215" font-size="70" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${letter}</text></svg>`,
  );

const me: Profile = {
  id: "me",
  display_name: "Tolu",
  birthdate: "1997-04-12",
  gender: "man",
  bio: "Product designer by day, amateur chef by night. I make a mean jollof and I'll fight you about the best Afrobeats album.",
  interests: ["Music", "Food", "Travel", "Art", "Comedy"],
  photos: [photo("#7b5cf0", "#f2b33d", "T"), photo("#1f9d6b", "#5b3fd9", "T")],
  open_to_masquerade: true,
  pref_intent: "dating",
  pref_seeking: "women",
  pref_age_min: 21,
  pref_age_max: 31,
  pref_spice: 1,
  pref_max_km: 50,
};

const ada: Profile = {
  ...me,
  id: "ada",
  display_name: "Ada",
  birthdate: "1999-09-02",
  gender: "woman",
  bio: "Bookworm, beach lover, and the friend who always knows the best brunch spot.",
  interests: ["Books", "Travel", "Dancing", "Food"],
  photos: [photo("#e5484d", "#f2b33d", "A")],
};

const now = Date.now();
const iso = (s: number) => new Date(now - s * 1000).toISOString();

const session = (over: Partial<MasqueradeState> = {}): MasqueradeState => ({
  id: "s1",
  status: "active",
  ended_reason: null,
  intent: "dating",
  spice_level: 2,
  started_at: iso(180),
  ends_at: new Date(now + 120_000).toISOString(),
  server_now: new Date(now).toISOString(),
  match_id: "m1",
  me: { id: "me", alias: "Golden Fox", spice: 1, vote: null },
  them: { alias: "Velvet Owl", spice: 3, age: 26, gender: "woman", interests: ["Books", "Travel", "Dancing", "Food"], shared_interests: ["Travel", "Food"], distance_km: 4, has_voted: false, profile: null },
  ...over,
});

const msgs: ChatMessage[] = [
  { id: 1, sender_id: null, kind: "icebreaker", body: "What's your idea of a perfect first date?", created_at: iso(170) },
  { id: 2, sender_id: "ada", body: "Ooh okay. Street food market, then a long walk with no plan 😄", created_at: iso(160) },
  { id: 3, sender_id: "me", body: "A walk with no plan is elite. Where would we end up?", created_at: iso(150) },
  { id: 4, sender_id: "ada", body: "Somewhere with live music. You?", created_at: iso(140) },
  { id: 5, sender_id: "me", body: "Same, but I'm judging the jollof at every stop", created_at: iso(120) },
  { id: 6, sender_id: null, kind: "icebreaker", body: "What does chemistry feel like to you?", created_at: iso(90) },
  { id: 7, sender_id: "ada", body: "When the conversation just flows and you forget to check the time… like now?", created_at: iso(60) },
];

const recent = [
  { id: "m1", created_at: iso(3000), last_message_at: iso(200), intent: "dating" as const, other_id: "ada", display_name: "Ada", photos: [photo("#e5484d", "#f2b33d", "A")], age: 26, last_message: null, last_sender: null },
  { id: "m2", created_at: iso(3000), last_message_at: iso(200), intent: "friends" as const, other_id: "k", display_name: "Kemi", photos: [photo("#1f9d6b", "#f2b33d", "K")], age: 24, last_message: null, last_sender: null },
  { id: "m3", created_at: iso(3000), last_message_at: iso(200), intent: "spicy" as const, other_id: "z", display_name: "Zara", photos: [photo("#5b3fd9", "#e5484d", "Z")], age: 29, last_message: null, last_sender: null },
];

const APP_SCREENS = ["events-empty", "event-spotlight", "event-spotlight-live", "events", "event-upcoming", "event-live", "event-waiting", "event-ended", "home", "matches", "wallet", "profile", "rich-chat", "extend", "chat", "desktop-matches", "gifts", "home-next", "home-off", "home-clicked", "people", "feed", "feed-locked", "feed-chat", "feed-gifts"];

function ev(over: Partial<DashpadEvent> = {}): DashpadEvent {
  return {
    id: "e1", title: "Afrobeats Lovers", description: "Everyone here loves Afrobeats. Bring your best song recommendations and your dance-floor energy.",
    theme: "violet", intent: "dating", starts_at: new Date(now + 2 * 3600_000 + 14 * 60_000).toISOString(),
    ends_at: new Date(now + 3 * 3600_000 + 14 * 60_000).toISOString(), age_min: 21, age_max: 35, entry_keys: 20,
    max_attendees: null, status: "published", going_count: 1240, i_am_going: false, my_rounds: 0, my_unmasks: 0,
    kind: "masquerade", cover_url: null, stream_url: null, settings: {}, media: [], my_photo: null, my_chats: 0, reveals_used: 0,
    server_now: new Date(now).toISOString(), ...over,
  };
}

const adminNights: AdminNight[] = [
  { id: "e1", title: "Afrobeats Lovers", description: "Everyone here loves Afrobeats.", theme: "violet", intent: "dating", starts_at: new Date(now + 2 * 86400_000).toISOString(), ends_at: new Date(now + 2 * 86400_000 + 3600_000).toISOString(), age_min: 21, age_max: 35, entry_keys: 20, max_attendees: null, status: "published", going_count: 1240, rounds: 0, unmasks: 0, keys_collected: 24800, question_count: 3 },
  { id: "e2", title: "Faith & Friendship", description: "", theme: "mint", intent: "friends", starts_at: new Date(now + 5 * 86400_000).toISOString(), ends_at: new Date(now + 5 * 86400_000 + 3600_000).toISOString(), age_min: 18, age_max: 40, entry_keys: 0, max_attendees: 500, status: "draft", going_count: 0, rounds: 0, unmasks: 0, keys_collected: 0, question_count: 8 },
  { id: "e3", title: "Spicy Saturday", description: "", theme: "rose", intent: "spicy", starts_at: new Date(now + 6 * 86400_000).toISOString(), ends_at: new Date(now + 6 * 86400_000 + 5400_000).toISOString(), age_min: 25, age_max: 40, entry_keys: 30, max_attendees: null, status: "published", going_count: 312, rounds: 0, unmasks: 0, keys_collected: 9360, question_count: 12 },
  { id: "e4", title: "Valentine's Masquerade", description: "", theme: "rose", intent: "dating", starts_at: new Date(now - 9 * 86400_000).toISOString(), ends_at: new Date(now - 9 * 86400_000 + 7200_000).toISOString(), age_min: 21, age_max: 45, entry_keys: 25, max_attendees: null, status: "published", going_count: 2210, rounds: 8420, unmasks: 1930, keys_collected: 55250, question_count: 15 },
];

function demoHour(kind: "live" | "next" | "off" | "clicked" = "live"): MasqueradeHour {
  const h = new Date(now); h.setUTCMinutes(0, 0, 0);
  const end = new Date(h.getTime() + 3600_000).toISOString();
  return {
    enabled: kind !== "off", server_now: new Date(now).toISOString(), hour_at: h.toISOString(), hour_open: true, hour_ran: true, pairs_this_hour: 107,
    next_at: end,
    current: kind === "clicked" ? { id: "s1", status: "matched", intent: "dating", ends_at: end, match_id: "m1", my_alias: "Velvet Fox", their_alias: "Golden Owl", their_age: 26, their_gender: "woman", their_name: "Ada", their_photo: photo("#e5484d", "#f2b33d", "A"), my_vote: true, they_voted: true, messages: 12, last_message: null, last_from_them: null } : kind === "live" ? { id: "s1", status: "active", intent: "dating", ends_at: end, match_id: null, my_alias: "Velvet Fox", their_alias: "Golden Owl", their_age: 26, their_gender: "woman", their_place: "Lagos, Nigeria", their_connections: 4, their_reply_seconds: 140, their_name: null, their_photo: null, my_vote: null, they_voted: false, messages: 6, last_message: "Wait, you're into Afrobeats too?", last_from_them: true } : null,
    past: [
      { id: "p1", status: "lapsed", intent: "friends", hour_at: new Date(h.getTime() - 3 * 3600_000).toISOString(), reopened_at: null, their_alias: "Quiet Heron", their_age: 29, their_gender: "man", my_vote: true, last_message: "Haha same. Talk soon?" },
      { id: "p2", status: "active", intent: "dating", hour_at: new Date(h.getTime() - 26 * 3600_000).toISOString(), reopened_at: iso(3600), their_alias: "Wild Comet", their_age: 24, their_gender: "woman", my_vote: null, last_message: "You reopened the chat 👀" },
    ],
  };
}

const fa = (id: string, alias: string, body: string, over: Partial<FeedAnswer> = {}): FeedAnswer => ({
  id, alias, body, created_at: iso(1800), age: 26, gender: "woman", mine: false, reactions: {}, my_reaction: null, gifts: 0, chat_id: null, can_chat: true, matched: false, ...over,
});
const feedPrompt = { id: "p1", body: "What's the most toxic thing you find attractive?", day: "2026-10-22", chat_cost: 5, answers: 128 };
const feedDemo: Feed = {
  prompt: feedPrompt,
  gifts_unseen: 2,
  my_answer: { id: "mine", alias: "Velvet Fox", body: "Someone who replies 'k' but shows up with food. Mixed signals, full stomach.", created_at: iso(5400), hidden: false, reactions: 23, gifts: 2, chats: 1 },
  answers: [
    fa("a1", "Midnight Owl", "When they're a little bit rude to me but sweet to my mum. I can't explain it.", { reactions: { fire: 14, laugh: 31, hundred: 6 }, my_reaction: "laugh", gifts: 3, age: 27 }),
    fa("a2", "Golden Panther", "Confidence that borders on delusion. If you think you're Burna Boy, I'm listening.", { gender: "woman", age: 24, reactions: { fire: 8, hundred: 12 }, chat_id: "c1" }),
    fa("a3", "Quiet Heron", "Being bad at texting but great in person. I'm the problem honestly.", { gender: "man", age: 29, reactions: { eyes: 4 }, can_chat: false }),
    fa("a4", "Electric Comet", "Jealousy. A little bit. Like 2%. Ok maybe 10%.", { age: 25, reactions: {} }),
  ],
};
const feedGifts: FeedGift[] = [
  { id: 1, gift_id: "rose", created_at: iso(900), seen_at: null, answer_body: feedDemo.my_answer!.body, prompt_body: feedPrompt.body, from_id: "t", from_name: "Tunde", from_photo: photo("#5b3fd9", "#f2b33d", "T"), from_age: 29, from_gender: "man", chat_id: null, can_chat: true, match_id: null },
  { id: 2, gift_id: "teddy", created_at: iso(7200), seen_at: null, answer_body: feedDemo.my_answer!.body, prompt_body: feedPrompt.body, from_id: "d", from_name: "David", from_photo: photo("#1f9d6b", "#e5484d", "D"), from_age: 31, from_gender: "man", chat_id: "c9", can_chat: true, match_id: null },
];

export function PreviewScreen({ screen }: { screen: string }) {
  const inner = <ScreenBody screen={screen} />;
  if (!APP_SCREENS.includes(screen)) return inner;
  return (
    <EventMediaProvider userId="me">
      <Sidebar user={{ id: "me", name: "Tolu", photo: me.photos[0] }} />
      <div className="lg:pl-[var(--sidebar-w)] lg:transition-[padding] lg:duration-300">{inner}</div>
    </EventMediaProvider>
  );
}

function ScreenBody({ screen }: { screen: string }) {
  switch (screen) {
    case "onboarding-2":
      return <Onboarding profile={{ ...me, bio: "", interests: ["Music", "Travel"] }} demoStep={1} />;
    case "onboarding-3":
      return <Onboarding profile={me} demoStep={2} />;
    case "all-set":
      return <Onboarding profile={me} demoDone />;
    case "onboarding":
      return <Onboarding profile={{ ...me, display_name: "", birthdate: null, gender: null }} />;
    case "masquerade":
      return (
        <div className="pb-24">
          <HomeScreen profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "place":
      return <PlacePicker open onClose={() => {}} userId="me" current={{ country: "NG", region: "Lagos" }} onSaved={() => {}} />;
    case "people":
      return <div className="pb-24"><YourPeople matches={recent} myId="me" /><BottomNav /></div>;
    case "admin-prices":
      return <AdminShell><PricesManager settings={{ reopen_cost: 10, reveal_cost: 1, free_reveals: 10 }}
        gifts={[{ id: "fire", name: "Fire", emoji: "🔥", price: 5, sort: 1, retired: false }, { id: "rose", name: "Rose", emoji: "🌹", price: 5, sort: 2, retired: false }, { id: "jollof", name: "Jollof", emoji: "🍛", price: 15, sort: 5, retired: false }, { id: "teddy", name: "Teddy bear", emoji: "🧸", price: 30, sort: 91, retired: true }]}
        packs={[{ id: "p50", keys: 50, naira: 750, tag: null, sort: 1, active: true }, { id: "p150", keys: 150, naira: 2000, tag: "Popular", sort: 2, active: true }, { id: "p500", keys: 500, naira: 4500, tag: "Best value", sort: 3, active: true }]} /></AdminShell>;
    case "admin-masquerade": {
      const base = new Date(now); base.setUTCMinutes(0, 0, 0);
      const hours = Array.from({ length: 48 }, (_, i) => {
        const t = new Date(base.getTime() - i * 3600_000);
        const lh = (t.getUTCHours() + 1) % 24;
        const open = ![2, 3, 4, 5].includes(lh);
        const pairs = open ? 20 + ((i * 7) % 30) : 0;
        return { hour_at: t.toISOString(), open, ran_at: open && i !== 9 ? t.toISOString() : null, eligible: open ? pairs * 2 + 3 : null, note: i === 14 ? "late" : null, pairs: i === 14 ? 0 : pairs, clicked: Math.round(pairs * 0.2), undecided: Math.round(pairs * 0.3), reopened: Math.round(pairs * 0.05), quiet: Math.round(pairs * 0.25), let_go: Math.round(pairs * 0.2), live: i === 0 ? pairs : 0, not_notified: 0 };
      });
      return <AdminShell><MasqueradeHealth stats={{ now: new Date(now).toISOString(), hours, switched_on: 1840, eligible_now: 960, no_place: 212, week: { pairs: 4120, clicked: 830, quiet: 1010, reopened: 190 }, by_mood: { friends: 1500, dating: 1900, spicy: 720 } }} /></AdminShell>;
    }
    case "home-clicked":
      return <div className="pb-24"><HomeScreen hour={demoHour("clicked")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} /><BottomNav /></div>;
    case "home-next":
    case "home-off":
      return (
        <div className="pb-24">
          <HomeScreen hour={demoHour(screen === "home-off" ? "off" : "next")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "room-hourly":
    case "room-lapsed":
      return (
        <MasqueradeRoom
          initial={{ ...session(), hourly: true, status: screen === "room-lapsed" ? "lapsed" : "active", ends_at: new Date(now + 41 * 60_000).toISOString() }}
          initialMessages={msgs}
          demo={{ remaining: screen === "room-lapsed" ? 0 : 41 * 60 + 12 }}
        />
      );
    case "home":
      return (
        <div className="pb-24">
          <HomeScreen hour={demoHour()} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "sheet-keys":
    case "sheet-meet":
    case "sheet-intent":
    case "sheet-spice":
    case "sheet-distance":
    case "sheet-seeking":
      return <HomeScreen profile={me} wallet={{ balance: 3, passes: 0, free_left: 0, next_free_at: new Date(now + 3 * 3600_000 + 12 * 60_000).toISOString() }} stats={null} matches={[]} hour={demoHour("next")} demoSheet="meet" />;
    case "buttons":
      return (
        <div className="mx-auto max-w-md space-y-3 p-5 pt-16">
          <Button size="lg" loading loadingText="Logging you in…">Log in</Button>
          <Button variant="gold" size="lg" loading loadingText="Masking up…">Put on your mask</Button>
          <Button variant="secondary" size="lg" loading loadingText="Saving…">Save</Button>
          <div className="pt-4"><InterestPicker value={["Music", "Travel", "Food", "Art", "Books", "Movies", "Dancing", "Comedy"]} onChange={() => {}} /></div>
        </div>
      );
    case "waiting":
      return <HomeScreen profile={me} wallet={null} stats={null} matches={[]} hour={demoHour("next")} />;
    case "chat":
      return <MasqueradeRoom initial={session()} initialMessages={msgs} demo={{ remaining: 121 }} />;
    case "decide":
      return <MasqueradeRoom initial={session()} initialMessages={msgs} demo={{ remaining: 0 }} />;
    case "matched":
      return (
        <Outcome
          state={session({
            status: "matched",
            them: { ...session().them, profile: { id: "ada", display_name: "Ada", bio: ada.bio, photos: ada.photos } },
          })}
        />
      );
    case "ended":
      return <Outcome state={session({ status: "ended", ended_reason: "declined", me: { ...session().me, vote: true } })} />;
    case "invite":
      return (
        <div className="pb-24">
          <HomeScreen profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <InviteSheet
            invite={{ id: "i", intent: "dating", spice: 2, from_age: 27, distance_km: 3, expires_at: new Date(now + 38_000).toISOString() }}
            onAccept={() => {}}
            onDecline={() => {}}
            onExpire={() => {}}
          />
        </div>
      );
    case "matches":
      return (
        <div className="pb-24">
          <MatchesList
            myId="me"
            matches={[
              { id: "m1", created_at: iso(3000), last_message_at: iso(200), intent: "dating", other_id: "ada", display_name: "Ada", photos: ada.photos, age: 26, last_message: "When the conversation just flows…", last_sender: "ada", shared: 2 },
              { id: "m2", created_at: iso(90000), last_message_at: iso(7200), intent: "friends", other_id: "x", display_name: "Kemi", photos: [photo("#1f9d6b", "#f2b33d", "K")], age: 24, last_message: "Haha see you Saturday!", last_sender: "me", shared: 3 },
              { id: "m3", created_at: iso(20000), last_message_at: iso(19000), intent: "spicy", other_id: "y", display_name: "Zara", photos: [photo("#5b3fd9", "#e5484d", "Z")], age: 29, last_message: null, last_sender: null },
            ]}
          />
          <BottomNav />
        </div>
      );
    case "rich-chat":
      return (
        <MatchChat
          matchId="m1"
          myId="me"
          other={ada}
          shared={["Travel", "Food"]}
          matchedAt={iso(90000)}
          intent="dating"
          initialMessages={[
            { id: 11, sender_id: "ada", kind: "text", body: "Okay I have to show you the view from the rooftop 😍", created_at: iso(3600) },
            { id: 12, sender_id: "ada", kind: "image", body: "Lagos at golden hour", created_at: iso(3590), local_url: photo("#f2b33d", "#e5484d", "☀"), media_meta: { width: 400, height: 500 } },
            { id: 13, sender_id: "me", kind: "text", body: "Stop it, that's gorgeous. Saturday?", created_at: iso(3500), reply_to: 12 },
            { id: 14, sender_id: "ada", kind: "audio", body: "", created_at: iso(3400), media_meta: { duration: 14 } },
            { id: 15, sender_id: "me", kind: "call", body: "ended", created_at: iso(3000), media_meta: { call: "video", seconds: 754 } },
            { id: 16, sender_id: "me", kind: "audio", body: "", created_at: iso(200), media_meta: { duration: 6 } },
            { id: 17, sender_id: "ada", kind: "text", body: "Haha deal. I'll bring the playlist", created_at: iso(120), reply_to: 16 },
            { id: 18, sender_id: "me", kind: "text", body: "", deleted_at: iso(60), created_at: iso(80) },
          ]}
        />
      );
    case "desktop-matches":
      return (
        <div className="lg:flex lg:h-dvh">
          <aside className="hidden lg:block lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-cream">
            <MatchesList myId="me" variant="sidebar" matches={[
              { id: "m1", created_at: iso(3000), last_message_at: iso(120), intent: "dating", other_id: "ada", display_name: "Ada", photos: ada.photos, age: 26, last_message: "Haha deal. I'll bring the playlist", last_sender: "ada", shared: 2 },
              { id: "m2", created_at: iso(90000), last_message_at: iso(7200), intent: "friends", other_id: "x", display_name: "Kemi", photos: [photo("#1f9d6b", "#f2b33d", "K")], age: 24, last_message: "See you Saturday!", last_sender: "me", shared: 3 },
              { id: "m3", created_at: iso(20000), last_message_at: iso(19000), intent: "spicy", other_id: "y", display_name: "Zara", photos: [photo("#5b3fd9", "#e5484d", "Z")], age: 29, last_message: null, last_sender: null },
            ]} />
          </aside>
          <div className="min-w-0 lg:flex-1">
            <ScreenBody screen="rich-chat" />
          </div>
        </div>
      );
    case "events-empty":
      return <EventsScreen events={[]} />;
    case "events":
      return <EventsScreen events={[ev({ starts_at: iso(1200), ends_at: new Date(now + 2400_000).toISOString(), i_am_going: true, going_count: 186 }), ev({ id: "e2", title: "Faith & Friendship", theme: "mint", intent: "friends", entry_keys: 0, starts_at: new Date(now + 3 * 86400_000).toISOString(), ends_at: new Date(now + 3 * 86400_000 + 3600_000).toISOString(), going_count: 54 }), ev({ id: "e3", title: "Spicy Saturday", theme: "rose", intent: "spicy", age_min: 25, age_max: 40, starts_at: new Date(now + 5 * 86400_000).toISOString(), ends_at: new Date(now + 5 * 86400_000 + 5400_000).toISOString(), going_count: 312 })]} />;
    case "event-upcoming":
      return <EventLobby userId="me" event={ev({ i_am_going: false })} />;
    case "event-live":
      return <EventLobby userId="me" event={ev({ starts_at: iso(1200), ends_at: new Date(now + 2400_000).toISOString(), i_am_going: true, my_rounds: 3, my_unmasks: 1 })} />;
    case "event-waiting":
      return <EventLobby userId="me" demo="waiting" event={ev({ starts_at: iso(1200), ends_at: new Date(now + 2400_000).toISOString(), i_am_going: true, my_rounds: 3, my_unmasks: 1 })} />;
    case "event-ended":
      return <EventLobby userId="me" event={ev({ starts_at: iso(7200), ends_at: iso(3600), i_am_going: true, my_rounds: 9, my_unmasks: 2 })} />;
    case "event-spotlight":
    case "event-spotlight-live":
      return (
        <EventSpace
          userId="me"
          myPhotos={me.photos}
          myInterests={me.interests}
          event={ev({
            id: "s1", title: "Afrobeats Spotlight", kind: "spotlight", theme: "rose", entry_keys: 0, i_am_going: true, going_count: 186,
            my_photo: me.photos[0],
            ...(screen === "event-spotlight-live" ? { starts_at: iso(1200), ends_at: new Date(now + 2400_000).toISOString() } : {}),
          })}
        />
      );
    case "auth-login":
    case "auth-signup":
      return (
        <AuthShell title="Welcome to Dashpad" subtitle="Log in or create an account. Just your email to start.">
          <AuthFlow demo={{ step: screen === "auth-login" ? "login" : "signup", email: "tolu@example.com" }} />
        </AuthShell>
      );
    case "admin-members":
      return (
        <AdminShell>
          <MembersList
            total={2841}
            q=""
            filter="all"
            page={1}
            pageSize={30}
            rows={[
              { id: "1", display_name: "Ada", photo: photo("#e5484d", "#f2b33d", "A"), gender: "woman", age: 26, created_at: iso(86400), last_seen_at: iso(60), email: "ada@example.com", banned_at: null, balance: 120, reports: 0, matches: 4, onboarded: true },
              { id: "2", display_name: "Kemi", photo: photo("#1f9d6b", "#f2b33d", "K"), gender: "woman", age: 24, created_at: iso(3 * 86400), last_seen_at: iso(7200), email: "kemi@example.com", banned_at: null, balance: 15, reports: 2, matches: 1, onboarded: true },
              { id: "3", display_name: "Tunde", photo: photo("#5b3fd9", "#f2b33d", "T"), gender: "man", age: 31, created_at: iso(9 * 86400), last_seen_at: iso(5 * 86400), email: "tunde@example.com", banned_at: iso(86400), balance: 0, reports: 5, matches: 0, onboarded: true },
              { id: "4", display_name: null, photo: null, gender: null, age: null, created_at: iso(3600), last_seen_at: iso(3600), email: "newbie@example.com", banned_at: null, balance: 0, reports: 0, matches: 0, onboarded: false },
            ]}
          />
        </AdminShell>
      );
    case "admin-member":
      return (
        <AdminShell>
          <MemberDetail
            id="2"
            info={{
              profile: { id: "2", display_name: "Kemi", gender: "woman", bio: "Weekend baker, weekday spreadsheet wizard. Looking for someone who laughs at their own jokes.", interests: ["Food", "Music", "Travel", "Comedy"], photos: [photo("#1f9d6b", "#f2b33d", "K"), photo("#7b5cf0", "#ff8fb8", "K")], open_to_masquerade: true, pref_intent: "dating", created_at: iso(3 * 86400), last_seen_at: iso(7200) },
              age: 24, email: "kemi@example.com", terms_accepted_at: iso(3 * 86400), banned_at: null, ban_reason: null,
              wallet: { balance: 15, passes: 0 }, matches: 1, masquerades: 12, events: 2,
              reports_against: [
                { id: 1, reason: "Rude in chat", created_at: iso(86400), reporter_id: "1", reporter_name: "Ada" },
                { id: 2, reason: "Spam", created_at: iso(7200), reporter_id: "3", reporter_name: "Tunde" },
              ],
              reports_made: 0,
              transactions: [
                { id: 3, amount: -10, reason: "extend", ref: null, created_at: iso(7200) },
                { id: 2, amount: -5, reason: "gift", ref: "rose", created_at: iso(86400) },
                { id: 1, amount: 30, reason: "purchase", ref: null, created_at: iso(2 * 86400) },
              ],
              paid_naira: 750,
            }}
          />
        </AdminShell>
      );
    case "admin-night-spotlight":
      return <AdminShell><NightEditor night={{ ...adminNights[0], kind: "spotlight", settings: { free_reveals: 10, reveal_cost: 1, max_chats: 5 } }} /></AdminShell>;
    case "admin":
      return <AdminShell><AdminOverview promptsAhead={1} overview={{ users: 2841, new_users_7d: 312, online_now: 214, masquerades_today: 1290, unmasks_today: 388, matches_total: 6120, revenue_30d_kobo: 184500000, keys_sold_30d: 112400, gifts_7d: 2290, reports_7d: 4, icebreakers: 112 }} nights={adminNights} /></AdminShell>;
    case "feed":
    case "feed-gifts":
      return (
        <div className="pb-24">
          <FeedScreen initial={feedDemo} myId="me" wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} demoGifts={feedGifts} demoGiftsOpen={screen === "feed-gifts"} />
          <BottomNav badges={{ chats: 2, eventLive: false, feedNew: false, feedGifts: 2 }} />
        </div>
      );
    case "feed-locked":
      return (
        <div className="pb-24">
          <FeedScreen initial={{ prompt: feedPrompt, gifts_unseen: 0, my_answer: null, answers: [] }} myId="me" wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} />
          <BottomNav badges={{ chats: 0, eventLive: false, feedNew: true, feedGifts: 0 }} />
        </div>
      );
    case "feed-chat":
      return (
        <FeedChat
          myId="me"
          chat={{
            id: "c1", status: "open", match_id: null, opened_by: "me", created_at: iso(3 * 3600), expires_at: new Date(now + 21 * 3600_000).toISOString(),
            decide_by: new Date(now + 45 * 3600_000).toISOString(), prompt_body: feedPrompt.body,
            answer_body: "Confidence that borders on delusion. If you think you're Burna Boy, I'm listening.", answer_mine: false, my_keep: null, their_keep_set: false,
            me: { id: "me", name: "Silver Lynx", masked: true, photo: null, age: 28, gender: "man" },
            other: { id: "o", name: "Golden Panther", masked: true, photo: null, age: 24, gender: "woman" },
            messages: [
              { id: 1, sender_id: "me", body: "Ok but how delusional are we talking? 😂", created_at: iso(3 * 3600) },
              { id: 2, sender_id: "o", body: "Like 'I can sing' when you can't. Main character energy", created_at: iso(3 * 3600 - 120) },
              { id: 3, sender_id: "me", body: "Then I'm your guy. I sing in traffic every morning", created_at: iso(3 * 3600 - 200) },
            ],
          }}
        />
      );
    case "admin-prompts": {
      const day = (n: number) => { const d = new Date(now + 3600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
      const P = (n: number, body: string, answers = 0) => ({ id: "p" + n, body, day: day(n), chat_cost: 5, created_at: iso(0), answers, hidden: answers ? 2 : 0, reactions: answers * 6, gifts: Math.round(answers / 9), chats: Math.round(answers / 5), reports: n === -1 ? 3 : 0 });
      return <AdminShell><PromptManager today={day(0)} prompts={[
        P(0, feedPrompt.body, 128), P(1, "Describe your ideal Sunday in 5 words."), P(2, "What's a green flag nobody talks about?"), P(4, "Jollof: Ghana or Nigeria? Defend your answer."),
        P(-1, "Your most toxic trait?", 412), P(-2, "What song would play when you walk into a room?", 356),
      ]} /></AdminShell>;
    }
    case "admin-prompt-answers":
      return <AdminShell><PromptAnswers today="2026-10-22" prompt={{ id: "p", body: "Your most toxic trait?", day: "2026-10-21" }} answers={[
        { id: "x1", alias: "Bold Dove", body: "I screenshot everything. Everything.", created_at: iso(0), hidden_at: null, user_id: "u", display_name: "Kemi Ade", photo: photo("#1f9d6b", "#f2b33d", "K"), reactions: 40, gifts: 2, reports: 3 },
        { id: "x2", alias: "Wild Fox", body: "I say I'm 5 minutes away when I haven't showered.", created_at: iso(0), hidden_at: null, user_id: "u2", display_name: "Tunde B", photo: null, reactions: 81, gifts: 6, reports: 0 },
        { id: "x3", alias: "Misty Hare", body: "(removed by admin)", created_at: iso(0), hidden_at: iso(0), user_id: "u3", display_name: "Sam", photo: null, reactions: 1, gifts: 0, reports: 1 },
      ]} /></AdminShell>;
    case "admin-nights":
      return <AdminShell><NightsList nights={adminNights} /></AdminShell>;
    case "admin-night":
      return <AdminShell><NightEditor night={adminNights[0]} questions={["Which Afrobeats song never leaves your playlist?", "Best concert you've ever been to?", "Who's your dream duet partner?"]} /></AdminShell>;
    case "admin-icebreakers":
      return <AdminShell><IcebreakerManager initial={[
        { id: 1, spice: 0, body: "What's a small thing that made you smile this week?", active: true, created_at: iso(0) },
        { id: 2, spice: 0, body: "Beach holiday or city break?", active: true, created_at: iso(0) },
        { id: 3, spice: 1, body: "What's your biggest dating ick?", active: true, created_at: iso(0) },
        { id: 4, spice: 1, body: "Texting all day or calling at night?", active: false, created_at: iso(0) },
        { id: 5, spice: 2, body: "Where's the best place for a first kiss?", active: true, created_at: iso(0) },
        { id: 6, spice: 2, body: "Morning kisses or goodnight kisses?", active: true, created_at: iso(0) },
        { id: 7, spice: 3, body: "What's a fantasy you'd only admit behind a mask?", active: true, created_at: iso(0) },
        { id: 8, spice: 3, body: "If tonight had no rules, what would you do?", active: true, created_at: iso(0) },
      ]} /></AdminShell>;
    case "wallet":
      return (
        <div className="pb-24">
          <WalletScreen
            userId="me"
            wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }}
            result="paid"
            history={[
              { id: 4, amount: -10, reason: "extend", created_at: iso(600) },
              { id: 3, amount: -20, reason: "gift", created_at: iso(3600) },
              { id: 2, amount: -5, reason: "extra_masquerade", created_at: iso(7200) },
              { id: 1, amount: 120, reason: "purchase", created_at: iso(9000) },
            ]}
          />
          <BottomNav />
        </div>
      );
    case "gifts":
      return (
        <>
          <MatchChat matchId="m1" myId="me" other={ada} shared={["Travel"]} intent="dating" initialMessages={[
            { id: 1, sender_id: "ada", kind: "text", body: "That was the best 5 minutes of my week", created_at: iso(300) },
            { id: 2, sender_id: "ada", kind: "gift", body: "bouquet", media_meta: { gift: "bouquet" }, created_at: iso(240) },
            { id: 3, sender_id: "me", kind: "gift", body: "crown", media_meta: { gift: "crown" }, created_at: iso(120) },
          ]} />
          <GiftSheet open onClose={() => {}} balance={120} toName="Ada" onSend={async () => null} />
        </>
      );
    case "extend":
      return <MasqueradeRoom initial={session()} initialMessages={[...msgs, { id: 8, sender_id: "ada", kind: "gift", body: "rose", created_at: iso(30) }, { id: 9, sender_id: "me", kind: "system", body: "Golden Fox added 2 more minutes", created_at: iso(20) }]} demo={{ remaining: 74 }} />;
    case "call-incoming":
      return <CallScreen call={{ id: "c", matchId: "m1", kind: "video", role: "callee", peer: { name: "Ada", photo: ada.photos[0] }, status: "incoming" }} localStream={null} remoteStream={null} muted={false} cameraOff={false} mirrored onAccept={() => {}} onDecline={() => {}} onHangUp={() => {}} onToggleMute={() => {}} onToggleCamera={() => {}} onFlip={() => {}} />;
    case "call-audio":
      return <CallScreen call={{ id: "c", matchId: "m1", kind: "audio", role: "caller", peer: { name: "Ada", photo: ada.photos[0] }, status: "connected", connectedAt: now - 83_000 }} localStream={null} remoteStream={null} muted cameraOff={false} mirrored onAccept={() => {}} onDecline={() => {}} onHangUp={() => {}} onToggleMute={() => {}} onToggleCamera={() => {}} onFlip={() => {}} />;
    case "match-chat":
      return <MatchChat matchId="m1" myId="me" other={ada} shared={["Travel", "Food"]} matchedAt={iso(3000)} intent="dating" initialMessages={msgs.map((m) => (m.kind === "icebreaker" ? { ...m, body: "💬 " + m.body } : m))} />;
    case "matches-empty":
      return (
        <div className="pb-24">
          <MatchesList myId="me" matches={[]} />
          <BottomNav />
        </div>
      );
    case "profile-preview":
      return <ProfileSheet profile={ada} shared={["Travel", "Food"]} onClose={() => {}} />;
    case "profile":
      return (
        <div className="pb-24">
          <ProfileEditor profile={me} email="tolu@example.com" matchCount={3} />
          <BottomNav />
        </div>
      );
    default:
      return <p className="p-10">Unknown screen</p>;
  }
}
