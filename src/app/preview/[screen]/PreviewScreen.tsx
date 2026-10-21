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

const APP_SCREENS = ["event-spotlight", "event-spotlight-live", "events", "event-upcoming", "event-live", "event-waiting", "event-ended", "home", "matches", "wallet", "profile", "rich-chat", "extend", "chat", "desktop-matches", "gifts"];

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
    case "home":
      return (
        <div className="pb-24">
          <HomeScreen profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "sheet-keys":
    case "sheet-meet":
    case "sheet-intent":
    case "sheet-spice":
    case "sheet-distance":
    case "sheet-seeking":
      return <HomeScreen profile={me} wallet={{ balance: 3, passes: 0, free_left: 0, next_free_at: new Date(now + 3 * 3600_000 + 12 * 60_000).toISOString() }} stats={null} matches={[]} demoSheet={screen === "sheet-keys" ? "keys" : "meet"} />;
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
      return <HomeScreen profile={me} wallet={null} stats={null} matches={[]} demoWaiting />;
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
      return <AdminShell><AdminOverview overview={{ users: 2841, new_users_7d: 312, online_now: 214, masquerades_today: 1290, unmasks_today: 388, matches_total: 6120, revenue_30d_kobo: 184500000, keys_sold_30d: 112400, gifts_7d: 2290, reports_7d: 4, icebreakers: 112 }} nights={adminNights} /></AdminShell>;
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
