"use client";

import { DailyMock } from "./DailyMocks";
import { BigMomentPop, CoreMock } from "./CoreMocks";
import { AuraMock } from "./AuraMocks";
import { MaskPhotoMock } from "./MaskPhotoMocks";
import { MaskFlowMock } from "./MaskFlowMocks";
import { MaskEngineTest } from "./MaskEngineTest";
import { MaskGallery } from "./MaskGallery";
import { HealthPage } from "@/components/admin/HealthPage";
import { MaskBounds } from "./MaskBounds";
import { MaskAllPhotos } from "@/components/admin/MaskAllPhotos";
import { MaskedNotice } from "@/components/masks/MaskedNotice";
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
import { StickerSheet } from "@/components/stickers/StickerSheet";
import { Masky } from "@/components/stickers/Masky";
import { STICKER_PACKS } from "@/lib/stickers";
import type { Drawing } from "@/lib/scribble";
import { PaintSampleMock, TogetherMock, paintSample } from "./ScribbleMocks";
import { CardsMock, PoolMock, WordsMock, XOMock } from "./GameMocks";
import { TogetherBoard } from "@/components/stickers/TogetherBoard";

// A sample scribble: a neon heart, a rainbow swoosh and glitter stars
const sampleScribble: Drawing = (() => {
  const heart: number[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 2;
    heart.push(Math.round(150 + 72 * Math.pow(Math.sin(t), 3)), Math.round(128 - (58 * Math.cos(t) - 22 * Math.cos(2 * t) - 9 * Math.cos(3 * t) - 4 * Math.cos(4 * t))), 16);
  }
  const swoosh: number[] = [];
  for (let i = 0; i <= 40; i++) swoosh.push(40 + i * 5.5, Math.round(250 - Math.sin((i / 40) * Math.PI) * 30), 14);
  const star = (cx: number, cy: number, r: number) => {
    const out: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      out.push(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 30);
    }
    return out;
  };
  return {
    v: 1,
    strokes: [
      { b: "neon", c: "#ff7aa8", s: 11, p: heart },
      { b: "rainbow", c: "#000", s: 12, p: swoosh },
      { b: "glitter", c: "#ffb02e", s: 7, p: star(60, 60, 26) },
      { b: "glitter", c: "#7a5cf0", s: 6, p: star(248, 52, 20) },
    ],
  };
})();
import { MaskedVoiceSheet } from "@/components/chat/MaskedVoiceSheet";
import { MatchPopView } from "@/components/app/MatchPop";
import { Outcome } from "@/components/masquerade/Outcome";
import { MatchesList } from "@/components/matches/MatchesList";
import { MatchChat } from "@/components/matches/MatchChat";
import { ProfileSheet } from "@/components/matches/ProfileSheet";
import { ThingsDeck } from "@/components/profile/ThingsDeck";
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
import { PlayScreen } from "@/components/play/PlayScreen";
import { GameDemo } from "./GameDemos";
import { ChatBgGallery } from "./ChatBgGallery";
import { GamesManager } from "@/components/admin/GamesManager";
import { ThingsManager } from "@/components/admin/ThingsManager";
import { ErrorsList } from "@/components/admin/ErrorsList";
import { PROMPTS, TONES } from "@/lib/things";
import type { Feed, FeedAnswer, FeedGift } from "@/lib/feed";
import type { MasqueradeHour } from "@/lib/hourly";
import type { ChatMessage, MasqueradeState, Profile } from "@/lib/types";
import type { Meet, MeetChat, MeetList } from "@/lib/meets";
import { MeetScreen } from "@/components/meets/MeetScreen";
import { ExploreScreen } from "@/components/explore/ExploreScreen";
import { MediaHelp } from "@/components/app/MediaHelp";
import { SEED_QUESTIONS, type Pact, type PactQuestion } from "@/lib/pacts";
import { YouBoth } from "@/components/matches/YouBoth";
import { PactFlow } from "@/components/pacts/PactFlow";
import { PactCard } from "@/components/pacts/PactCard";
import { MaskedChats } from "@/components/matches/MaskedChats";
import { MessagePops, type Pop } from "@/components/app/MessagePops";
import { PactsAdmin } from "@/components/admin/PactsAdmin";
import { PactEditor } from "@/components/admin/PactEditor";
import { PactInsights } from "@/components/admin/PactInsights";
import { AdminPreview } from "@/components/pacts/AdminPreview";
import type { ExploreList, ExploreProfile, Viewers } from "@/lib/explore";

const photo = (a: string, b: string, letter: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="200" cy="190" r="80" fill="#fff" opacity=".35"/><rect x="90" y="300" width="220" height="200" rx="110" fill="#fff" opacity=".35"/><text x="200" y="215" font-size="70" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${letter}</text></svg>`,
  );

const me: Profile = {
  id: "me",
  things: [
    { p: "food", a: "Jollof rice" },
    { p: "music", a: "Asake on repeat" },
    { p: "team", a: "Arsenal, sadly" },
    { p: "weekend", a: "Owambe till late" },
  ],
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
const demoPact: Pact = {
  id: "00000000-0000-0000-0000-00000000aaaa", slug: "lagos-pact", name: "The Lagos Pact", tagline: "Answer 10 questions. On reveal night, meet the person most like you.",
  logo_url: null, header_url: null, accent: "#f2c45a", intents: ["business", "friendship", "love", "spicy"], areas: ["Island", "Mainland"], email_domain: null,
  closes_at: new Date(now + 4 * 86400_000 + 5 * 3600_000).toISOString(), reveal_at: new Date(now + 6 * 86400_000).toISOString(), status: "live", matched_at: null,
};
const demoQs: PactQuestion[] = SEED_QUESTIONS.map((q, i) => ({ ...q, id: `q${i}`, position: i }));
const pactWrap = (el: React.ReactNode) => <div className="min-h-dvh bg-[#140d24] text-white">{el}</div>;

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
  them: { alias: "Velvet Owl", spice: 3, age: 26, gender: "woman", interests: ["Books", "Travel", "Dancing", "Food"], shared_interests: ["Travel", "Food"], things: [{ p: "food", a: "Jollof rice, then suya after" }, { p: "weekend", a: "Beach day" }, { p: "music", a: "Tems" }], distance_km: 4, has_voted: false, online: true, seen_minutes: 0, profile: null },
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
  { id: "m1", created_at: iso(3000), last_message_at: iso(200), intent: "dating" as const, other_id: "ada", display_name: "Ada", photos: [photo("#e5484d", "#f2b33d", "A")], age: 26, last_message: "Are you coming?", last_sender: "ada", unread: true },
  { id: "m2", created_at: iso(3000), last_message_at: iso(200), intent: "friends" as const, other_id: "k", display_name: "Kemi", photos: [photo("#1f9d6b", "#f2b33d", "K")], age: 24, last_message: null, last_sender: null },
  { id: "m3", created_at: iso(3000), last_message_at: iso(200), intent: "spicy" as const, other_id: "z", display_name: "Zara", photos: [photo("#5b3fd9", "#e5484d", "Z")], age: 29, last_message: null, last_sender: null },
];

const APP_SCREENS = ["events-empty", "event-spotlight", "event-spotlight-live", "events", "event-upcoming", "event-live", "event-waiting", "event-ended", "home", "matches", "wallet", "profile", "rich-chat", "extend", "chat", "desktop-matches", "gifts", "home-next", "home-wait", "voice-chat", "voice-sheet", "voice-sheet-normal", "voice-record", "home-off", "home-clicked", "people", "feed", "feed-locked", "feed-chat", "feed-gifts", "meet", "meet-events", "meet-post", "explore"];

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

function demoHour(kind: "live" | "next" | "off" | "clicked" | "wait" = "live"): MasqueradeHour {
  const h = new Date(now); h.setUTCMinutes(0, 0, 0);
  const end = new Date(h.getTime() + 3600_000).toISOString();
  return {
    enabled: kind !== "off", server_now: new Date(now).toISOString(), hour_at: h.toISOString(), hour_open: true, hour_ran: true, pairs_this_hour: 107,
    next_at: kind === "wait" ? end : new Date(now).toISOString(),
    looking: kind === "next",
    pulse: { all: 412, country: 230, region: 12, region_name: "Lagos" },
    invite_reward: 10,
    current: kind === "clicked" ? { id: "s1", status: "matched", intent: "dating", ends_at: end, match_id: "m1", my_alias: "Velvet Fox", their_alias: "Golden Owl", their_age: 26, their_gender: "woman", their_name: "Ada", their_photo: photo("#e5484d", "#f2b33d", "A"), my_vote: true, they_voted: true, messages: 12, last_message: null, last_from_them: null } : kind === "live" ? { id: "s1", status: "active", intent: "dating", ends_at: end, match_id: null, my_alias: "Velvet Fox", their_alias: "Golden Owl", their_age: 26, their_gender: "woman", their_place: "Oyo, Nigeria", their_connections: 4, their_reply_seconds: 140, their_tier: "country", their_name: null, their_photo: null, my_vote: null, they_voted: false, messages: 6, last_message: "Wait, you're into Afrobeats too?", last_from_them: true } : null,
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

const meet = (over: Partial<Meet>): Meet => ({
  id: Math.random().toString(36).slice(2), kind: "game", game: "c4", body: "", alias: "Velvet Fox", created_at: iso(20),
  ends_at: new Date(now + 2 * 3600_000).toISOString(), mine: false, age: 26, gender: "woman", session_id: null, people: 3, waiting: null, ...over,
});
const demoMeets: MeetList = {
  server_now: new Date(now).toISOString(),
  cost: 0,
  hours: 3,
  mine: null,
  posts: [
    meet({ alias: "Velvet Fox", body: "Nobody has beaten me this week" }),
    meet({ alias: "Golden Heron", kind: "text", game: null, body: "Best small chops spot in Lekki? Wrong answers only", ends_at: new Date(now + 100 * 60_000).toISOString() }),
    meet({ alias: "Misty Owl", game: "words", body: "Words are my thing", ends_at: new Date(now + 40 * 60_000).toISOString(), session_id: "s1" }),
    meet({ alias: "Lucky Swan", kind: "text", game: null, body: "Jollof: party or home-made? Defend your answer", ends_at: new Date(now + 150 * 60_000).toISOString() }),
  ],
};
const demoMeetChats: MeetChat[] = [
  { id: "c1", status: "active", ends_at: new Date(now + 2 * 3600_000).toISOString(), mine: true, kind: "game", game: "c4", post: "", their_alias: "Quiet Lynx", my_vote: null, game_status: "invited", in_line: true, last_message: "Ready when you are" },
  { id: "c2", status: "active", ends_at: new Date(now + 2 * 3600_000).toISOString(), mine: true, kind: "game", game: "c4", post: "", their_alias: "Bold Comet", my_vote: null, game_status: null, in_line: true, last_message: null },
  { id: "c3", status: "active", ends_at: new Date(now + 100 * 60_000).toISOString(), mine: false, kind: "text", game: null, post: "Best small chops spot in Lekki?", their_alias: "Golden Heron", my_vote: null, game_status: null, in_line: false, last_message: "Okay that one made me laugh 😂" },
];

const explorePeople: ExploreList = {
  message_cost: 15,
  photos_cost: 5,
  people: [
    ["Ada", 26, "#e5484d", "#f2b33d", true, false], ["Kemi", 24, "#5b3fd9", "#ffd166", true, true], ["Zainab", 25, "#1f9d6b", "#efebfd", false, false],
    ["Bisi", 27, "#c2306b", "#fdf3dc", false, false], ["Ife", 23, "#2563eb", "#f2b33d", true, false], ["Tola", 28, "#a26b00", "#efebfd", false, false],
    ["Funmi", 25, "#6d4ff0", "#e5f6ee", false, true], ["Chioma", 26, "#0f5c3e", "#ffd166", false, false], ["Amaka", 24, "#e8962a", "#5b3fd9", true, false],
  ].map(([name, age, a, b, online, connected], i) => ({
    id: `p${i}`, name: name as string, age: age as number, gender: "woman" as const, photo: photo(a as string, b as string, (name as string)[0]),
    place: i % 2 ? "Yaba, Lagos" : "Akoka, Lagos", intent: "dating" as const, online: online as boolean, connected: connected as boolean,
  })),
};

// Home shows 20: the Explore people again under other names
const NAMES = ["Tomi", "Femi", "Dami", "Seyi", "Nneka", "Uche", "Chioma", "Lola", "Bayo", "Kunle", "Amaka", "Ifeoma"];
const homePeople: ExploreList = {
  ...explorePeople,
  people: Array.from({ length: 20 }, (_, i) => {
    const p = explorePeople.people[i % explorePeople.people.length];
    return i < explorePeople.people.length ? p : { ...p, id: `${p.id}-${i}`, name: NAMES[i % NAMES.length], online: i % 3 === 0, connected: false };
  }),
};
// Masked chats in Recent chats (Home)
const homeMasked = [
  { id: "s1", alias: "Golden Owl", last_message: "Haha you're funny", last_mine: false, last_at: iso(100), unread: true },
  { id: "s2", alias: "Quiet Heron", last_message: "Talk later", last_mine: false, last_at: iso(900), unread: false },
  { id: "s3", alias: "Wild Comet", last_message: "Hi 👋", last_mine: true, last_at: iso(5000), unread: false },
];
// Who viewed you (Home)
const homeViews: Viewers = {
  today: 10,
  people: homePeople.people.slice(0, 10).map((p, i) => ({
    id: p.id, name: p.name, photo: p.photo, online: p.online, seen_at: new Date(Date.now() - (i * 47 + 6) * 60_000).toISOString(),
    waved_me: i === 1 || i === 4, i_waved: i === 3, connected: false,
  })),
};
const exploreProfile: ExploreProfile = {
  id: "p0", name: "Ada", age: 26, gender: "woman", bio: "Bookworm, beach lover, and the friend who always knows the best brunch spot.",
  interests: ["Books", "Travel", "Dancing", "Food"], place: "Akoka, Lagos", intent: null, online: true,
  photos: [photo("#e5484d", "#f2b33d", "A")], photo_count: 4, photos_unlocked: false, match_id: null,
  shared_interests: ["Travel", "Food"], message_cost: 15, photos_cost: 5,
};

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
  if (screen.startsWith("new-xo-")) return <XOMock step={Number(screen.slice(-1)) as 1 | 2 | 3} />;
  if (screen.startsWith("new-words-")) return <WordsMock step={Number(screen.slice(-1)) as 1 | 2} />;
  if (screen.startsWith("new-cards-")) return <CardsMock step={Number(screen.slice(-1)) as 1 | 2} />;
  if (screen === "mask-bounds") return <MaskBounds />;
  if (screen === "mask-engine") return <MaskEngineTest />;
  if (screen === "mask-gallery") return <MaskGallery />;
  if (screen === "masked-notice")
    return (
      <MaskedNotice
        userId="me"
        photos={[
          { masked: "https://x.test/m1.jpg", real: "https://x.test/r1.jpg", mask: { mask: "venetian", color: null, trim: "gold", faces: [{ cx: 0.44, cy: 0.24, s: 0.0028, rot: 0, sx: 1 }], auto: true } },
          { masked: "https://x.test/m2.jpg", real: "https://x.test/r2.jpg", mask: { mask: "fox", color: null, trim: "gold", faces: [{ cx: 0.44, cy: 0.24, s: 0.0028, rot: 0, sx: 1 }], auto: true } },
        ]}
      />
    );
  if (screen === "admin-masks") return <div className="p-4"><MaskAllPhotos /></div>;
  if (screen.startsWith("new-mm-")) return <MaskFlowMock step={Number(screen.slice(7))} />;
  if (screen.startsWith("new-mask-")) return <MaskPhotoMock step={Number(screen.slice(9))} />;
  if (screen.startsWith("new-aura-")) return <AuraMock step={Number(screen.slice(9))} />;
  if (screen.startsWith("new-core-")) return <CoreMock step={Number(screen.slice(9))} />;
  if (screen.startsWith("new-daily-")) return <DailyMock step={Number(screen.slice(-1)) as 1 | 2 | 3 | 4} />;
  if (screen.startsWith("new-pool-")) return <PoolMock step={Number(screen.slice(-1)) as 1 | 2} />;
  if (screen.startsWith("game-")) return <GameDemo screen={screen} />;
  if (screen === "chat-bgs") return <ChatBgGallery />;
  if (screen === "chat-bgs-moving") return <ChatBgGallery only={["beach", "sunset", "stars", "aurora", "rain", "snow", "hearts", "fireflies", "ocean", "clouds", "lagos", "bokeh"]} />;
  if (screen.startsWith("chat-bg-")) return <ChatBgGallery only={[screen.slice(8) as never]} big />;
  // Each mood's look: mood-friends-home, mood-spicy-chat, mood-dating-gifts…
  if (screen.startsWith("mood-")) {
    const [, intent, part] = screen.split("-") as [string, "friends" | "dating" | "spicy", string];
    if (part === "chat") return <MasqueradeRoom initial={session({ intent })} initialMessages={msgs} demo={{ remaining: 121 }} />;
    if (part === "gifts")
      return (
        <div className="min-h-dvh bg-cream">
          <GiftSheet open onClose={() => {}} balance={120} toName="Ada" intent={intent} onSend={async () => null} />
        </div>
      );
    return (
      <div className="pb-24">
        <HomeScreen demoPeople={homePeople} demoViews={homeViews} demoMasked={homeMasked} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour("wait")} profile={{ ...me, pref_intent: intent }} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} matches={recent} />
      </div>
    );
  }
  // The full-screen "you've been paired / it's a match" pop-ups, one per mood
  if (screen.startsWith("pop-")) {
    const [, intent, kind] = screen.split("-") as [string, "friends" | "dating" | "spicy", "pair" | "match"];
    return (
      <div className="pb-24">
        <HomeScreen demoPeople={homePeople} demoViews={homeViews} demoMasked={homeMasked} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour("wait")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} matches={recent} />
        <MatchPopView pop={{ kind, intent, name: kind === "pair" ? "Velvet Owl" : "Ada", href: "#", photo: photo("#e5484d", "#f2b33d", "A"), personId: "ada", myPhoto: photo("#5b3fd9", "#1f9d6b", "T"), myId: "me" }} onOpen={() => {}} onClose={() => {}} />
      </div>
    );
  }
  switch (screen) {
    case "play":
    case "play-waiting":
    case "play-found":
    case "play-keys":
    case "play-practice-whot":
    case "play-practice-ayo":
    case "play-practice-ludo":
    case "play-practice-snakes":
    case "play-practice-xo":
    case "play-practice-lastcard": {
      const status = {
        waiting: screen === "play-waiting" || screen.startsWith("play-practice"),
        joined_at: new Date(now - 23_000).toISOString(),
        game_id: null,
        game: "ludo" as const,
        intent: "dating" as const,
        seeking: "women",
        age_min: 22,
        age_max: 32,
        cost: 1,
        balance: screen === "play-keys" ? 0 : 120,
        games: ["whot", "ayo", "ludo", "snakes"] as ("whot" | "ayo" | "ludo" | "snakes")[],
        in_line: screen === "play-waiting" ? 0 : 2,
        playing: 7,
        server_now: new Date(now).toISOString(),
      };
      const practice = screen.startsWith("play-practice-") ? (screen.slice(14) as "whot" | "ayo" | "ludo" | "snakes" | "xo" | "lastcard") : undefined;
      return <PlayScreen userId="me" demo={{ status, practice, phase: screen === "play-waiting" || practice ? "waiting" : screen === "play-found" ? "found" : "idle" }} />;
    }
    case "room-games":
      return (
        <MasqueradeRoom
          initial={{ ...session(), hourly: true, status: "active", ends_at: new Date(now + 41 * 60_000).toISOString() }}
          initialMessages={[
            ...msgs,
            { id: 8, sender_id: null, kind: "game", body: "Connect 4", created_at: iso(30), media_meta: { kind: "c4", a: "me", b: "ada", sa: 2, sb: 1, winner: "me", status: "done" } },
            { id: 9, sender_id: "ada", body: "Rematch. Right now 😤", created_at: iso(20) },
            { id: 10, sender_id: null, kind: "game", body: "This or That", created_at: iso(10), media_meta: { kind: "tot", a: "ada", b: "me", sa: 8, sb: 8, winner: null, status: "done", detail: { qs: [{ q: "Pick one forever", a: "Jollof rice", b: "Fried rice" }, { q: "Perfect Saturday night?", a: "Owambe till 4am", b: "Netflix and suya" }, { q: "Pets", a: "Dogs", b: "Cats" }, { q: "Calls or texts?", a: "Calls", b: "Texts" }], picks: [["a", "a"], ["a", "b"], ["b", "b"], ["b", "a"]] } } as never },
            { id: 11, sender_id: null, kind: "game", body: "Two Truths & a Lie", created_at: iso(5), media_meta: { kind: "truths", a: "me", b: "ada", sa: 1, sb: 0, winner: "me", status: "done", detail: { lines_a: ["I speak French", "I hate rice", "I met Davido"], lines_b: ["I once ate 3 plates of jollof at a wedding", "I have a twin brother", "I learnt to code from YouTube"], lie_a: 2, lie_b: 1, guess_a: 1, guess_b: 0 } } as never },
          ]}
          demo={{ remaining: 41 * 60 + 12 }}
        />
      );
    case "admin-things":
      return (
        <AdminShell>
          <ThingsManager
            rows={PROMPTS.map((p, i) => ({
              id: p.id,
              text: p.text,
              ideas: p.ideas,
              tone: (Object.keys(TONES) as (keyof typeof TONES)[]).find((k) => TONES[k] === p.tone) ?? "violet",
              sort: (i + 1) * 10,
              repeatable: p.id === "else" || p.id === "fact",
              active: p.id !== "team",
            }))}
            counts={{ food: 412, weekend: 380, music: 377 }}
          />
        </AdminShell>
      );
    case "admin-health":
      return (
        <AdminShell>
          <HealthPage
            missing={false}
            health={{
              people: { total: 1240, joined: 186, joined_prev: 142, active_day: 312, active_week: 804 },
              retention_week: { cohort: 150, back: 41 },
              retention_month: { cohort: 220, back: 19 },
              modes: [
                { mode: "friends", active: 210, women: 98, men: 104, other: 8 },
                { mode: "dating", active: 466, women: 140, men: 320, other: 6 },
                { mode: "spicy", active: 128, women: 22, men: 104, other: 2 },
              ],
              masquerade: { pairs: 940, pairs_prev: 810, both_unmasked: 203, both_unmasked_prev: 150, reported: 12 },
              play: { games: 1320, games_prev: 1104, waits: 1400, wait_median: 38, wait_p90: 145, waiting_now: 6 },
              safety: {
                reports: 21, reports_prev: 15, reported_people: 14, hidden: 63, hidden_prev: 48, auto_limit: 3,
                to_review: [{ id: "1", name: "Femi", photo: null, at: iso(3600), reports: 4, reasons: ["Asked me for money", "Rude", "Fake photos"] }],
                most_reported: [{ id: "2", name: "Seyi", photo: null, n: 2 }, { id: "3", name: "Uche", photo: null, n: 1 }],
              },
              money: { buyers: 31, buyers_prev: 24, revenue_kobo: 8_450_000, revenue_prev_kobo: 6_100_000 },
              invites: { joined: 54, joined_prev: 30, inviters: 37 },
            }}
          />
        </AdminShell>
      );
    case "admin-errors": {
      const e = (id: number, message: string, mins: number, name: string | null) => ({
        id, message, created_at: iso(mins * 60), name, url: "/matches/420d8", agent: "Mozilla/5.0 (Linux; Android 14) Chrome/130",
        stack: "build 442a40e\nTypeError: Cannot read properties of undefined (reading 'a')\n    at tp (6637-c81759582b61c099.js:1:117167)",
      });
      return (
        <AdminShell>
          <ErrorsList rows={[e(3, "[game snakes cancelled] Cannot read properties of undefined (reading 'a')", 5, "Plenty"), e(2, "[game snakes cancelled] Cannot read properties of undefined (reading 'a')", 40, "Tolu"), e(1, "[hidden] Couldn't load voice note", 90, null)]} />
        </AdminShell>
      );
    }
    case "admin-games":
      return (
        <AdminShell>
          <GamesManager
            on={{ truths: true, tot: true, c4: true, words: false }}
            questions={[
              { id: 1, prompt: "Perfect Saturday night?", a: "Owambe till 4am", b: "Netflix and suya", spice: 0, active: true },
              { id: 2, prompt: "Pick one forever", a: "Jollof rice", b: "Fried rice", spice: 0, active: true },
              { id: 3, prompt: "First move", a: "I make it", b: "I wait for it", spice: 1, active: true },
              { id: 4, prompt: "Rather kiss", a: "In the rain", b: "Under the stars", spice: 2, active: false },
            ]}
            ideas={[{ id: 1, body: "I have been to…", active: true }, { id: 2, body: "I can cook…", active: true }, { id: 3, body: "I have a tattoo of…", active: false }]}
            week={{ kinds: [{ kind: "tot", challenges: 412, started: 350, finished: 331, declined: 40, expired: 22, rematches: 96, in_people_chats: 60 }, { kind: "c4", challenges: 280, started: 230, finished: 201, declined: 30, expired: 20, rematches: 88, in_people_chats: 51 }, { kind: "truths", challenges: 150, started: 120, finished: 101, declined: 18, expired: 12, rematches: 20, in_people_chats: 14 }, { kind: "words", challenges: 190, started: 160, finished: 152, declined: 20, expired: 10, rematches: 55, in_people_chats: 33 }], pairs_with_games: 620, pairs_with_games_unmasked: 205, pairs_total: 4120, pairs_unmasked: 830 }}
            today={{ kinds: [{ kind: "tot", challenges: 61, started: 0, finished: 0, declined: 0, expired: 0, rematches: 0, in_people_chats: 0 }], pairs_with_games: 0, pairs_with_games_unmasked: 0, pairs_total: 0, pairs_unmasked: 0 }}
          />
        </AdminShell>
      );
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
          <HomeScreen profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} demoPeople={homePeople} />
          <BottomNav />
        </div>
      );
    case "place":
      return <PlacePicker open onClose={() => {}} userId="me" current={{ country: "NG", region: "Lagos" }} onSaved={() => {}} />;
    case "people":
      return <div className="pb-24"><YourPeople matches={recent} myId="me" /><BottomNav /></div>;
    case "admin-prices":
      return <AdminShell><PricesManager settings={{ reopen_cost: 10, reveal_cost: 1, free_reveals: 10, invite_reward: 10, meet_cost: 10, meet_free_posts: 1, meet_hours: 3, explore_message_cost: 15, explore_photos_cost: 5, explore_photos_paid: 1, ghost_cost: 100, wave_cost: 0, pair_gap_minutes: 60, pair_minutes: 60, setup_reward: 5, signup_keys: 5, slow_reveal_cost: 10, gift_share_percent: 50, play_cost: 1, sticker_pack_cost: 40, scribble_cost: 1, draw_together_cost: 2 }} invites={{ joined: 64, joined_7d: 12, buyers: 19, keys_paid: 410, top: [{ name: "Tolu", joined: 9, earned: 90 }, { name: "Kemi", joined: 6, earned: 40 }] }}
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
      return <div className="pb-24"><HomeScreen demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour("clicked")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} /><BottomNav /></div>;
    case "home-next":
    case "home-wait":
    case "home-off":
      return (
        <div className="pb-24">
          <HomeScreen demoPeople={homePeople} demoViews={homeViews} demoMasked={homeMasked} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour(screen === "home-off" ? "off" : screen === "home-wait" ? "wait" : "next")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "room-hourly":
    case "room-lapsed":
    case "room-pact":
      return (
        <MasqueradeRoom
          initial={{ ...session(), hourly: true, status: screen === "room-lapsed" ? "lapsed" : "active", ends_at: new Date(now + 41 * 60_000).toISOString() }}
          initialMessages={msgs}
          demo={{ remaining: screen === "room-lapsed" ? 0 : 41 * 60 + 12 }}
          pact={screen === "room-pact" ? "The Lagos Pact" : null}
        />
      );
    case "media-help":
    case "media-help-blocked":
      return <MediaHelp demo={{ kind: "video", status: screen === "media-help" ? "idle" : "denied", dev: "iphone" }} />;
    case "explore":
      return <div className="pb-24"><ExploreScreen initial={explorePeople} /><BottomNav /></div>;
    case "explore-profile":
      return <ExploreScreen initial={explorePeople} demoProfile={exploreProfile} />;
    case "meet":
    case "meet-events":
      return (
        <div className="pb-24">
          <MeetScreen
            initial={{ ...demoMeets, mine: meet({ mine: true, alias: "Secret Panther", body: "Bet you can't beat me", people: 3, waiting: 2, ends_at: new Date(now + 168 * 60_000).toISOString() }) }}
            initialChats={demoMeetChats}
            events={[]}
            tab={screen === "meet" ? "meets" : "events"}
          />
          <BottomNav />
        </div>
      );
    case "meet-post":
      return <HomeScreen demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} hour={demoHour()} meets={demoMeets} demoSheet="post" />;
    case "room-meet":
    case "room-meet-mine":
      return (
        <MasqueradeRoom
          initial={{
            ...session(),
            hourly: true,
            ends_at: new Date(now + 2 * 3600_000).toISOString(),
            started_at: new Date(now - 3600_000).toISOString(),
            meet: {
              id: "m1", kind: "game", game: "c4", mine: screen === "room-meet-mine", turn_pending: true, ahead: screen === "room-meet-mine" ? 2 : 1,
              live_chat: screen === "room-meet-mine" ? { id: "c1", alias: "Quiet Lynx", status: "invited" } : null,
            },
          }}
          initialMessages={[
            { id: 1, sender_id: null, kind: "meet", body: "Nobody has beaten me this week", media_meta: { kind: "game", game: "c4", alias: "Velvet Fox" }, created_at: iso(30) },
            ...msgs.slice(1, 4),
          ]}
          demo={{ remaining: 2 * 3600 }}
        />
      );
    case "home-tour":
      return (
        <div className="pb-24">
          <HomeScreen demoTour demoPeople={homePeople} demoViews={homeViews} demoMasked={homeMasked} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour("next")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} matches={recent} />
          <BottomNav />
        </div>
      );
    case "home":
    case "home-pact":
    case "home-daily":
    case "home-daily-done":
    case "home-pop-pair":
    case "home-pop-match":
      return (
        <div className="pb-24">
          {screen.startsWith("home-pop-") && <BigMomentPop kind={screen === "home-pop-pair" ? "pair" : "match"} />}
          <HomeScreen demoDaily={screen === "home-daily" ? "todo" : screen === "home-daily-done" ? "done" : undefined} demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} meets={demoMeets} hour={demoHour()} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} pact={screen === "home-pact" ? { ...demoPact, count: 1 } : null} />
          <BottomNav />
        </div>
      );
    case "message-pops":
    case "message-pops-reply": {
      // New messages following you round the site: a banner, bubbles, and replying in place
      const adaPop: Pop = { key: "m:m1", kind: "match", id: "m1", href: "/matches/m1", name: "Ada", photo: ada.photos[0], personId: "ada", text: "Good morning, did you sleep at all", count: 2 };
      const heron: Pop = { key: "s:s1", kind: "masked", id: "s1", href: "/masquerade/s1", name: "Coral Heron", alias: "Coral Heron", text: "Haha same, I'm on the Island too", count: 1 };
      const reply = screen === "message-pops-reply";
      return (
        <div className="pb-24">
          <HomeScreen demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} meets={demoMeets} hour={demoHour()} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} />
          <BottomNav />
          <MessagePops
            userId="me"
            demo={{
              banner: reply ? undefined : adaPop,
              bubbles: reply ? [heron] : [adaPop, heron],
              open: reply ? adaPop : undefined,
              messages: [
                { id: 1, sender_id: "me", kind: "text", body: "My mum, and years of party rice research", created_at: iso(600) },
                { id: 2, sender_id: "ada", kind: "text", body: "Okay that's the best answer", created_at: iso(120) },
                { id: 3, sender_id: "ada", kind: "text", body: "Good morning, did you sleep at all", created_at: iso(30) },
              ],
            }}
          />
        </div>
      );
    }
    case "sheet-keys":
    case "sheet-meet":
    case "sheet-intent":
    case "sheet-spice":
    case "sheet-distance":
    case "sheet-seeking":
      return <HomeScreen demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} profile={me} wallet={{ balance: 3, passes: 0, free_left: 0, next_free_at: new Date(now + 3 * 3600_000 + 12 * 60_000).toISOString() }} stats={null} matches={[]} hour={demoHour("next")} demoSheet="meet" />;
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
      return <HomeScreen demoPeople={homePeople} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} profile={me} wallet={null} stats={null} matches={[]} hour={demoHour("next")} />;
    case "chat":
      return <MasqueradeRoom initial={session()} initialMessages={msgs} demo={{ remaining: 121 }} />;
    case "sticker-packs":
      return (
        <div className="min-h-dvh bg-cream p-6">
          {STICKER_PACKS.map((p) => (
            <section key={p.id} className="mb-6" data-pack={p.id}>
              <h2 className="mb-1 text-[20px] font-semibold">
                {p.name} {p.emoji} <span className="text-[14px] font-medium text-muted">· {p.free ? "Free" : "Premium"} · {p.tagline}</span>
              </h2>
              <div className="grid grid-cols-6 gap-2">
                {p.stickers.map((st) => (
                  <div key={st.pose} className="flex flex-col items-center rounded-3xl bg-surface p-2 shadow-card">
                    <Masky pose={st.pose} caption={st.caption} color={st.color} size={150} />
                    <span className="mt-1 text-center text-[11.5px] font-medium text-muted">{st.move}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      );
    case "scribble-paint":
      return <PaintSampleMock />;
    case "together-live":
      return <TogetherBoard id="d1" me="me" them={{ name: "Ada" }} onClose={() => {}} onSent={() => {}} />;
    case "together-2":
    case "together-3":
      return <TogetherMock step={Number(screen.slice(-1)) as 2 | 3} />;
    case "scribble-pad":
      return <StickerSheet open onClose={() => {}} onSend={() => {}} owned={[]} price={40} scribbleCost={1} onSendScribble={async () => null} startMode="scribble" together={{ name: "Ada", cost: 2, onStart: () => {} }} />;
    case "sticker-store":
      return <StickerSheet open onClose={() => {}} onSend={() => {}} owned={[]} price={40} onBuy={async () => null} startTab="savage" />;
    case "chat-stickers":
      return (
        <MasqueradeRoom
          initial={session()}
          initialMessages={[
            ...msgs.slice(0, 4),
            { id: 5, sender_id: "me", body: "Same, but I'm judging the jollof at every stop", created_at: iso(120), reactions: { ada: "😂", me: "😈" } },
            { id: 8, sender_id: "ada", kind: "sticker", body: "Jollof?", media_meta: { pose: "jollof", color: "#ffb02e" }, created_at: iso(3), reactions: { me: "❤️" } },
            { id: 9, sender_id: "me", body: "Party jollof, no argument", created_at: new Date(Date.now() - 60_000).toISOString(), edited_at: iso(1) },
            { id: 10, sender_id: "me", kind: "sticker", body: "Goodnight Su", media_meta: { pose: "sleep", color: "#e5484d" }, created_at: iso(1) },
            { id: 11, sender_id: "ada", kind: "scribble", body: "Scribble", media_meta: sampleScribble as unknown as ChatMessage["media_meta"], created_at: iso(1), reactions: { me: "😍" } },
            { id: 12, sender_id: "ada", kind: "draw", body: "Drawing together", media_meta: { draw: "d1", status: "open" } as unknown as ChatMessage["media_meta"], created_at: iso(1) },
            { id: 13, sender_id: "me", kind: "scribble", body: "Drawing", media_meta: { ...paintSample(400, 300), by: ["me", "ada"] } as unknown as ChatMessage["media_meta"], created_at: iso(1), reactions: { ada: "😍" } },
          ]}
          demo={{ remaining: 1800 }}
        />
      );
    case "voice-chat":
      return (
        <MasqueradeRoom
          initial={{ ...session(), hourly: true, status: "active", ends_at: new Date(now + 41 * 60_000).toISOString() }}
          initialMessages={[
            ...msgs,
            { id: 20, sender_id: "ada", kind: "audio", body: "🎤 Voice note", created_at: iso(120), media_meta: { key: "voice/s1/a.wav", duration: 9, voice: "deep" } },
            { id: 21, sender_id: "me", kind: "audio", body: "🎤 Voice note", created_at: iso(60), media_meta: { key: "voice/s1/b.wav", duration: 14, voice: "robot" } },
          ]}
          demo={{ remaining: 121 }}
        />
      );
    case "voice-sheet":
    case "voice-sheet-normal":
    case "voice-record":
      return (
        <div className="pb-24">
          <HomeScreen demoPeople={homePeople} demoViews={homeViews} demoMasked={homeMasked} demoSetup={{ place: true, push: false, things: 4, claimed: false, reward: 5 }} hour={demoHour("live")} profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} matches={recent} />
          <MaskedVoiceSheet
            open
            onClose={() => {}}
            sessionId="s1"
            demo={screen !== "voice-record"}
            allowNormal={screen === "voice-sheet-normal"}
            onSendBlob={screen === "voice-sheet-normal" ? async () => null : undefined}
          />
        </div>
      );
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
          <HomeScreen profile={me} wallet={{ balance: 120, passes: 0, free_left: 3, next_free_at: null }} stats={{ online: 214, week_chats: 12, week_unmasks: 5, gifts_received: 3 }} matches={recent} demoPeople={homePeople} />
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
            maskedDemo={[
              { id: "s1", alias: "Misty Moth", my_alias: "Golden Fox", from_meet: false, live_pair: true, ends_at: iso(-53 * 60), my_vote: null, they_unmasked: false, online: false, last_message: "Voice note", last_mine: true, last_at: iso(240), unread: false },
              { id: "s2", alias: "Coral Heron", my_alias: "Golden Fox", from_meet: true, my_vote: null, they_unmasked: false, online: true, last_message: "Hiii", last_mine: false, last_at: iso(30), unread: true },
            ]}
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
            { id: 19, sender_id: "ada", kind: "image", body: "Guess where I am 👀", created_at: iso(70), slow: true, media_meta: { width: 400, height: 500, preview: photo("#f2b33d", "#e5484d", "☀") } },
            { id: 20, sender_id: "me", kind: "text", body: "Ohh you're making me work for it", created_at: iso(60) },
            { id: 21, sender_id: "ada", kind: "text", body: "Keep talking and find out 😌", created_at: iso(50) },
            { id: 22, sender_id: "me", kind: "text", body: "Is it the beach?", created_at: iso(40) },
            { id: 23, sender_id: "me", kind: "image", body: "", created_at: iso(30), slow: true, local_url: photo("#5b3fd9", "#1f9d6b", "🌴"), media_meta: { width: 400, height: 400 } },
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
      return <AdminShell><AdminOverview promptsAhead={1} overview={{ users: 2841, new_users_7d: 312, online_now: 214, masquerades_today: 1290, unmasks_today: 388, matches_total: 6120, revenue_30d_kobo: 184500000, keys_sold_30d: 112400, gifts_7d: 2290, gift_keys_7d: 31400, gifts_free_7d: 640, reports_7d: 4, icebreakers: 112 }} nights={adminNights} /></AdminShell>;
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
    case "match-chat-play":
      return (
        <MatchChat
          matchId="m1"
          myId="me"
          other={ada}
          shared={[]}
          matchedAt={iso(3)}
          intent="friends"
          source="play"
          initialMessages={[
            { id: 901, sender_id: null, kind: "game", body: "Snakes & Ladders", created_at: iso(2), media_meta: { game: "g1", kind: "snakes", a: "me", b: "ada", sa: null, sb: null, winner: null, status: "cancelled", reason: null, by: null } as never },
          ]}
        />
      );
    case "match-chat-merged":
      return (
        <MatchChat
          matchId="m1"
          myId="me"
          other={ada}
          shared={["Travel", "Food"]}
          matchedAt={iso(3000)}
          intent="dating"
          initialMessages={[
            ...msgs.slice(0, 3).map((m) => (m.kind === "icebreaker" ? { ...m, body: "💬 " + m.body } : m)),
            {
              id: 900,
              sender_id: null,
              kind: "masked",
              body: "Your masked chat",
              created_at: iso(5),
              media_meta: {
                aliases: { me: "Purple Heron", ada: "Golden Owl" },
                from: "masquerade",
                started_at: iso(60),
                count: 4,
                messages: [
                  { s: null, k: "icebreaker", b: "What song is stuck in your head right now?", m: null, t: iso(58) },
                  { s: "ada", k: "text", b: "Calm Down. Every single day 😅", m: null, t: iso(57) },
                  { s: "me", k: "text", b: "Ha! Same. Rema has us all", m: null, t: iso(55) },
                  { s: "ada", k: "gift", b: "fire", m: null, t: iso(50) },
                ],
              } as never,
            },
          ]}
        />
      );
    case "match-chat":
      return <MatchChat matchId="m1" myId="me" other={ada} shared={["Travel", "Food"]} matchedAt={iso(3000)} intent="dating" initialMessages={msgs.map((m) => (m.kind === "icebreaker" ? { ...m, body: "💬 " + m.body } : m))} />;
    case "matches-empty":
      return (
        <div className="pb-24">
          <MatchesList myId="me" matches={[]} />
          <BottomNav />
        </div>
      );
    case "you-both":
      return (
        <div className="mx-auto max-w-md p-5">
          <YouBoth demo={{ connected: false, interests: ["Afrobeats", "Food", "Football"], place: "Lagos", tot: { same: 7, rounds: 10, items: [{ q: "Coffee or tea?", a: "Coffee" }, { q: "Beach or city?", a: "City" }, { q: "Early bird or night owl?", a: "Night owl" }] }, words: null, linkups: null }} />
          <div className="h-5" />
          <YouBoth demo={{ connected: true, interests: ["Afrobeats", "Food"], place: "Lagos", tot: { same: 7, rounds: 10, items: [{ q: "Coffee or tea?", a: "Coffee" }] }, words: ["jollof", "arsenal", "beach"], linkups: { count: 4, items: [{ pact: "Lagos Link-Up", q: "Money", a: "Save it for the future" }, { pact: "Lagos Link-Up", q: "Top artists", a: "Tems, Asake" }] } }} />
        </div>
      );
    case "profile-preview":
      return (
        <ProfileSheet
          profile={{
            ...ada,
            things: [
              { p: "food", a: "Jollof rice, Suya, Amala and ewedu, Pounded yam and egusi, Shawarma" },
              { p: "weekend", a: "Owambe till late" },
              { p: "music", a: "Burna Boy, Tems, Asake" },
              { p: "dream", a: "Start a business that helps small farmers in the North sell straight to buyers in Lagos" },
              { p: "else", a: "You just won 1 million Naira. What will you do: Spend it on a trip with friends, save half, and buy my mum a new phone too" },
            ],
          }}
          shared={["Travel", "Food"]}
          onClose={() => {}}
        />
      );
    case "things-deck":
      return <ThingsDeck open onClose={() => {}} things={me.things ?? []} onSaved={() => {}} demo />;
    case "pact-intro":
    case "pact-q1":
    case "pact-artists":
    case "pact-scale":
    case "pact-about":
    case "pact-finish":
    case "pact-done": {
      const st = screen.slice(5);
      const demoStep = st === "intro" ? { step: "intro" as const } : st === "q1" ? { step: "q" as const, qi: 0 } : st === "artists" ? { step: "q" as const, qi: 5 } : st === "scale" ? { step: "q" as const, qi: 7 } : { step: st as "about" | "finish" | "done" };
      return pactWrap(<PactFlow pact={demoPact} questions={demoQs} count={4127} signedIn={false} mine={null} result={null} demoStep={demoStep} />);
    }
    case "pact-edit": {
      const answers = Object.fromEntries(demoQs.map((q) => [q.id, q.kind === "scale" ? 4 : q.kind === "choose_many" ? q.options.slice(0, 3).map((o) => o.id) : q.options[1].id]));
      const about = { gender: "woman" as const, intents: ["friendship" as const], seeking: [], age: 26, ageMin: 22, ageMax: 32, area: "Island", work: undefined };
      return pactWrap(<PactFlow pact={demoPact} questions={demoQs} count={4127} signedIn mine={{ about, answers }} result={null} demoStep={{ step: "edit" }} />);
    }
    case "pact-finish-in":
      return pactWrap(<PactFlow pact={demoPact} questions={demoQs} count={4127} signedIn mine={null} result={null} demoStep={{ step: "finish" }} />);
    case "pact-finish-school":
      return pactWrap(<PactFlow pact={{ ...demoPact, name: "UNILAG Pact", email_domain: "unilag.edu.ng" }} questions={demoQs} count={1290} signedIn mine={null} result={null} demoStep={{ step: "finish" }} />);
    case "pact-closed":
      return pactWrap(<PactFlow pact={{ ...demoPact, closes_at: iso(3600), reveal_at: new Date(now + 9 * 3600_000).toISOString() }} questions={demoQs} count={1} signedIn={false} mine={null} result={null} />);
    case "pact-sunday":
      return pactWrap(<PactFlow pact={demoPact} questions={demoQs} count={1} signedIn={false} mine={null} result={null} demoStep={{ step: "q", qi: 6 }} />);
    case "pact-matching":
      return pactWrap(<PactFlow pact={{ ...demoPact, closes_at: iso(86400), reveal_at: iso(60) }} questions={demoQs} count={104219} signedIn={false} mine={null} result={null} />);
    case "pact-reveal":
    case "pact-teaser":
    case "pact-teaser-guest":
      return pactWrap(
        <PactFlow
          pact={{ ...demoPact, status: "revealed", closes_at: iso(2 * 86400), reveal_at: iso(600), matched_at: iso(600) }}
          questions={demoQs} count={4127} signedIn={screen !== "pact-teaser-guest"} mine={null}
          result={screen === "pact-reveal"
            ? { kind: "match", match: { alias: "Golden Panther", score: 87, intent: "business", age: 27, area: "Island", work: "Tech", shared: [{ q: "Your hustle", a: "Building my own thing" }, { q: "Money", a: "Save it for the future" }, { q: "Your top artists", a: "Tems" }, { q: "Jollof", a: "Party jollof, smoky" }], differ: { q: "Your ideal Friday night", mine: "Owambe till 3am", theirs: "Movie and suya at home" }, sessionId: "s1", theyHaveAccount: true } }
            : { kind: "teaser", score: 87, intent: "business", inCommon: 4, rematch: false }}
        />,
      );
    case "pact-events":
      return (
        <div className="pb-24">
          <EventsScreen events={[]} pacts={[{ ...demoPact, count: 4127 }, { ...demoPact, id: "p2", slug: "unilag-pact", name: "UNILAG Pact", accent: "#7cc8ff", count: 1290, closes_at: iso(3600), reveal_at: new Date(now + 2 * 3600_000).toISOString() }]} />
          <BottomNav />
        </div>
      );
    case "pact-profile":
      return (
        <div className="pb-24">
          <ProfileEditor profile={me} email="tolu@example.com" matchCount={3} demoPacts={[
            { slug: "lagos-pact", name: "The Lagos Pact", logo_url: null, accent: "#f2c45a", reveal_at: iso(600), closes_at: iso(86400), status: "revealed", score: 87, intent: "business", shared: [], session_id: "s1", match_alias: "Golden Panther" },
            { slug: "unilag-pact", name: "UNILAG Pact", logo_url: null, accent: "#7cc8ff", reveal_at: new Date(now + 5 * 86400_000).toISOString(), closes_at: new Date(now + 3 * 86400_000).toISOString(), status: "live", score: null, intent: null, shared: null, session_id: null, match_alias: null },
          ]} />
          <BottomNav />
        </div>
      );
    case "pact-chats":
      return (
        <div className="mx-auto max-w-md px-5 pt-6 pb-24">
          <h1 className="font-display text-[34px] font-semibold">Chats</h1>
          <MaskedChats demo={[
            { id: "s0", alias: "Hidden", my_alias: "Silver Lynx", from_meet: false, pact: "UNILAG Pact", pact_slug: "unilag-pact", pact_seen: false, my_vote: null, they_unmasked: false, last_message: null, last_mine: null, last_at: iso(60), unread: true },
            { id: "s1", alias: "Golden Panther", my_alias: "Silver Lynx", from_meet: false, pact: "The Lagos Pact", pact_slug: "lagos-pact", pact_seen: true, my_vote: null, they_unmasked: false, last_message: null, last_mine: null, last_at: iso(300), unread: true },
            { id: "s2", alias: "Coral Heron", my_alias: "Silver Lynx", from_meet: true, my_vote: null, they_unmasked: false, last_message: "Haha same, I'm on the Island too", last_mine: false, last_at: iso(4000), unread: false },
          ]} />
          <BottomNav />
        </div>
      );
    case "admin-pacts":
      return <AdminShell><PactsAdmin pacts={[
        { id: demoPact.id, slug: "lagos-pact", name: "The Lagos Pact", accent: "#f2c45a", logo_url: null, status: "live", closes_at: demoPact.closes_at, reveal_at: demoPact.reveal_at, matched_at: null, created_at: iso(86400 * 3), count: 4127, matches: 0 },
        { id: "p2", slug: "unilag-pact", name: "UNILAG Pact", accent: "#7cc8ff", logo_url: null, status: "draft", closes_at: demoPact.closes_at, reveal_at: demoPact.reveal_at, matched_at: null, created_at: iso(3600), count: 0, matches: 0 },
      ]} /></AdminShell>;
    case "admin-pact-preview":
      return <AdminPreview pact={{ ...demoPact, status: "draft" }} questions={demoQs} count={0} as="open" />;
    case "admin-pact-answers": {
      const n = 4127;
      const split = (q: number, shares: number[]) => shares.map((f, k) => ({ q: `q${q}`, a: String.fromCharCode(97 + k), n: Math.round(n * f) }));
      return (
        <AdminShell>
          <PactInsights
            pact={{ ...demoPact, closes_at: iso(3600), reveal_at: new Date(now + 9 * 3600_000).toISOString(), reveal_step: "ready", reveal_stats: {} }}
            questions={demoQs}
            insights={{
              entries: n, with_account: 1630, today: 412,
              answers: [...split(0, [0.58, 0.42]), ...split(1, [0.47, 0.53]), ...split(2, [0.71, 0.29]), ...split(3, [0.62, 0.38]), ...split(4, [0.55, 0.45]), ...split(5, [0.61, 0.52, 0.44, 0.48, 0.57, 0.33, 0.29, 0.18, 0.21, 0.24, 0.27, 0.19, 0.12, 0.15, 0.09, 0.22]), ...split(6, [0.31, 0.27, 0.16, 0.18, 0.08]), ...[1, 2, 3, 4, 5].map((v, k) => ({ q: "q7", a: String(v), n: Math.round(n * [0.08, 0.17, 0.33, 0.27, 0.15][k]) })), ...split(8, [0.66, 0.34]), ...split(9, [0.52, 0.48])],
              answered: Object.fromEntries(demoQs.map((q) => [q.id, n])),
              intents: { business: 1720, friendship: 2480, love: 1950, spicy: 690 }, gender: { woman: 2190, man: 1937 }, areas: { Island: 2310, Mainland: 1817 },
              work: { Tech: 520, Finance: 310, "Creative & media": 280, "Building my own thing": 390, Student: 220 },
              ages: { "18-21": 610, "22-25": 1380, "26-30": 1240, "31-35": 560, "36-45": 270, "46+": 67 },
              matches: { total: 1896, rematches: 0, avg_score: 84, by_intent: { love: 760, spicy: 210, business: 480, friendship: 446 }, seen: 0, chats: 0, both_joined: 412 },
            }}
            people={[
              { id: "p1", email: "tolu.a@gmail.com", user_id: "u1", created_at: iso(300), match_seen_at: null, about: { gender: "woman", intents: ["business", "love"], seeking: ["man"], age: 27, ageMin: 25, ageMax: 35, area: "Island", work: "Tech" }, answers: { q0: "b", q1: "a", q2: "a", q3: "a", q4: "a", q5: ["d", "e"], q6: "b", q7: 2, q8: "a", q9: "a" } },
              { id: "p2", email: "kemi@yahoo.com", user_id: null, created_at: iso(900), match_seen_at: null, about: { gender: "woman", intents: ["friendship"], seeking: [], age: 23, ageMin: 20, ageMax: 30, area: "Mainland" }, answers: { q0: "a", q1: "b", q2: "b", q3: "a", q4: "b", q5: ["a", "b", "c"], q6: "a", q7: 5, q8: "b", q9: "b" } },
            ]}
            page={1}
            perPage={50}
          />
        </AdminShell>
      );
    }
    case "admin-pact":
      return <AdminShell><PactEditor pact={demoPact} questions={demoQs} count={4127} matches={0} /></AdminShell>;
    case "pact-home-card":
      return <div className="mx-auto max-w-md p-5"><PactCard pact={{ ...demoPact, count: 4127 }} compact /></div>;
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
