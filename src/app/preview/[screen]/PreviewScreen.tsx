"use client";

import { HomeScreen } from "@/components/home/HomeScreen";
import { WalletScreen } from "@/components/keys/WalletScreen";
import { GiftSheet } from "@/components/keys/GiftSheet";
import { MasqueradeRoom } from "@/components/masquerade/MasqueradeRoom";
import { Outcome } from "@/components/masquerade/Outcome";
import { MatchesList } from "@/components/matches/MatchesList";
import { MatchChat } from "@/components/matches/MatchChat";
import { ProfileSheet } from "@/components/matches/ProfileSheet";
import { CallScreen } from "@/components/calls/CallScreen";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { BottomNav } from "@/components/app/BottomNav";
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

export function PreviewScreen({ screen }: { screen: string }) {
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
