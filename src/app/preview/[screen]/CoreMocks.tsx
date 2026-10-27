"use client";

// Design previews: doubling down on Masquerade (masked pairs) as the heart of Dashpad.
// Static sample screens (new-core-1 … new-core-11); not wired up.
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Headphones,
  Heart,
  MapPin,
  MessageCircle,
  Mic,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { KeyCoin } from "@/components/keys/KeyIcon";

const HERO = "radial-gradient(120% 90% at 85% 0%, #7a5cf0 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, #2b1d73 0%, transparent 60%), #4730b3";
const NIGHT = "radial-gradient(100% 60% at 50% 30%, #5b3fd9 0%, #2b1d73 45%, #120b2e 100%)";

const OWL = {
  alias: "Velvet Owl",
  age: 26,
  who: "Woman",
  place: "Lagos Island",
  color: "#e5484d",
  vibe: ["🌙 Night owl", "🍲 Foodie", "🎶 Afrobeats", "😂 Big laugher"],
  song: { title: "Love Me JeJe", artist: "Tems" },
  things: ["Can't swim but owns 4 swimsuits", "Will judge your jollof, respectfully", "Sundays are for Bogobiri and live music"],
  common: ["Afrobeats", "Foodie", "Night owl", "Island person"],
};

function Mask({ color, size = 44, ring }: { color: string; size?: number; ring?: boolean }) {
  return (
    <span className={"grid shrink-0 place-items-center rounded-full " + (ring ? "ring-[3px] ring-white" : "")} style={{ width: size, height: size, background: color }}>
      <span className="block" style={{ width: size * 0.58 }}>
        <MaskIcon className="w-full text-ink" eyes={color} />
      </span>
    </span>
  );
}

function Chip({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" | "gold" | "mint" }) {
  const t =
    tone === "dark" ? "bg-white/15 text-white" : tone === "gold" ? "bg-gold-soft text-[#8a5a00]" : tone === "mint" ? "bg-mint-soft text-[#137a52]" : "bg-brand-soft text-brand-ink";
  return <span className={"inline-flex shrink-0 items-center gap-1 rounded-full whitespace-nowrap px-2.5 py-1 text-[12.5px] font-semibold " + t}>{children}</span>;
}

/** The new bottom bar: Home (your pair), Discover (masked people), Chats, Profile */
function Nav({ on }: { on: 0 | 1 | 2 | 3 }) {
  const items = [
    { l: "Home", i: <MaskIcon className="w-[26px]" /> },
    { l: "Discover", i: <Sparkles size={22} /> },
    { l: "Chats", i: <MessageCircle size={22} /> },
    { l: "Profile", i: <UserRound size={22} /> },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pt-2 pb-3 backdrop-blur">
      {items.map((x, i) => (
        <span key={x.l} className={"flex flex-1 flex-col items-center gap-1 text-[11.5px] font-semibold " + (i === on ? "text-brand" : "text-muted")}>
          {x.i}
          {x.l}
        </span>
      ))}
    </nav>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3 px-4 pt-4">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#ff9a6b] to-[#c2410c] text-[16px] font-bold text-white">T</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">Good evening</span>
        <span className="block text-[19px] leading-tight font-semibold">Tolu</span>
      </span>
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold-soft pr-4 pl-1.5 text-[15px] font-bold text-[#8a5a00]">
        <KeyCoin size={30} /> 120
      </span>
    </header>
  );
}

function Section({ title, more, children }: { title: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {more && <span className="text-[13px] font-semibold text-brand">{more}</span>}
      </div>
      {children}
    </section>
  );
}

/** Below the hero on Home: your people (unmasked), missed connections, something to do while you wait */
function HomeBelow() {
  return (
    <>
      <Section title="Missed connections" more="All">
        <div className="flex items-center gap-3 rounded-[22px] bg-white p-3.5 shadow-[0_10px_24px_-20px_rgba(20,10,40,0.4)] ring-1 ring-line">
          <Mask color="#5b3fd9" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Quiet Heron · 28</span>
            <span className="block truncate text-[12.5px] text-muted">The hour ran out. You both liked the chat.</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-3 py-2 text-[13px] font-bold text-white">
            <RotateCcw size={14} /> Free
          </span>
        </div>
      </Section>
      <Section title="Your people" more="Chats">
        <div className="flex gap-3">
          {[
            { n: "Ada", c: "from-[#ff9a6b] to-[#e5484d]" },
            { n: "Kemi", c: "from-[#7ad3a3] to-[#1f9d6b]" },
            { n: "Zara", c: "from-[#b49cff] to-[#5b3fd9]" },
          ].map((p) => (
            <span key={p.n} className="flex flex-col items-center gap-1">
              <span className={"grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-[18px] font-bold text-white " + p.c}>{p.n[0]}</span>
              <span className="text-[12px] font-semibold">{p.n}</span>
            </span>
          ))}
          <span className="flex flex-col items-center gap-1">
            <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-line-strong text-muted">
              <Plus size={20} />
            </span>
            <span className="text-[12px] font-semibold text-muted">Invite</span>
          </span>
        </div>
      </Section>
      <Section title="While you wait">
        <div className="flex items-center gap-3 rounded-[22px] p-3.5 text-white" style={{ background: "radial-gradient(120% 90% at 85% 10%, #2a8a5c, transparent 60%), #17663f" }}>
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/15 text-[20px]">🃏</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Play a stranger</span>
            <span className="block text-[12.5px] text-white/75">Masked, quick game, chat after</span>
          </span>
          <span className="rounded-full bg-gold px-3.5 py-2 text-[13px] font-extrabold text-ink">Play</span>
        </div>
      </Section>
    </>
  );
}

// 1. Home while you wait: the pair is the hero
function HomeWaiting() {
  return (
    <div className="min-h-dvh bg-cream pb-28 text-ink">
      <Header />
      <div className="relative mx-4 mt-4 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_50px_-24px_#2b1d73]" style={{ background: HERO }}>
        {/* Masks drifting in the background */}
        {[
          { x: 72, y: 8, s: 34, c: "#f2b33d", r: -12 },
          { x: 82, y: 34, s: 26, c: "#ff8a8a", r: 10 },
          { x: 64, y: 30, s: 22, c: "#7ad3a3", r: -4 },
        ].map((m, i) => (
          <span key={i} className="absolute opacity-80" style={{ left: `${m.x}%`, top: `${m.y}%`, transform: `rotate(${m.r}deg)` }}>
            <Mask color={m.c} size={m.s} />
          </span>
        ))}
        <p className="text-[12px] font-extrabold tracking-[0.16em] text-gold uppercase">Your next masked pair</p>
        <p className="mt-2 font-display text-[54px] leading-none font-black tabular-nums">12:40</p>
        <p className="mt-1 text-[14px] text-white/75">Picked for you at 9:00pm</p>

        <div className="mt-5 flex items-center gap-2.5">
          <span className="flex -space-x-2">
            {["#f2b33d", "#ff8a8a", "#7ad3a3", "#b49cff"].map((c) => (
              <Mask key={c} color={c} size={28} ring />
            ))}
          </span>
          <span className="text-[13.5px] font-semibold">
            <span className="text-gold">38 people</span> masked up right now
          </span>
        </div>

        <div className="mt-4 rounded-[18px] bg-black/20 p-3">
          <p className="text-[12px] font-bold text-white/60">Who we&apos;re looking for</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip tone="dark">💘 Dating</Chip>
            <Chip tone="dark">Women 22–30</Chip>
            <Chip tone="dark">
              <MapPin size={12} /> Near Yaba
            </Chip>
            <Chip tone="dark">Edit</Chip>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/70">
          <Bell size={14} /> We&apos;ll buzz you the second they&apos;re here
        </p>
      </div>
      <HomeBelow />
      <Nav on={0} />
    </div>
  );
}

// 2. Home when your pair arrives
function HomeArrived() {
  return (
    <div className="min-h-dvh bg-cream pb-28 text-ink">
      <Header />
      <div className="relative mx-4 mt-4 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_0_0_3px_#f2b33d,0_24px_50px_-20px_#f2b33d]" style={{ background: HERO }}>
        <p className="text-[12px] font-extrabold tracking-[0.16em] text-gold uppercase">Your pair is here</p>
        <div className="mt-3 flex items-center gap-3.5">
          <Mask color={OWL.color} size={64} ring />
          <span>
            <span className="block font-display text-[28px] leading-tight font-black">{OWL.alias}</span>
            <span className="block text-[14px] text-white/75">
              {OWL.age} · {OWL.who} · {OWL.place}
            </span>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {OWL.vibe.map((v) => (
            <Chip key={v} tone="dark">
              {v}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-black/20 px-3 py-2.5">
          <Headphones size={18} className="text-gold" />
          <span className="text-[13px]">
            On repeat: <b>{OWL.song.title}</b> · {OWL.song.artist}
          </span>
        </div>
        <p className="mt-3 text-[13px] font-semibold text-gold">✨ You have {OWL.common.length} things in common</p>
        <span className="gm-pulse mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">
          Say hi <span className="text-[13px] font-bold text-ink/60">· 60 min to chat</span>
        </span>
      </div>
      <HomeBelow />
      <Nav on={0} />
    </div>
  );
}

// 3. Home when it's quiet: honest, and still something to look forward to
function HomeQuiet() {
  return (
    <div className="min-h-dvh bg-cream pb-28 text-ink">
      <Header />
      <div className="relative mx-4 mt-4 overflow-hidden rounded-[30px] p-5 text-white" style={{ background: HERO }}>
        <p className="text-[12px] font-extrabold tracking-[0.16em] text-gold uppercase">You&apos;re first in line</p>
        <p className="mt-2 font-display text-[30px] leading-[1.1] font-black">It&apos;s quiet right now</p>
        <p className="mt-2 text-[14px] text-white/80">4 people are masked up, but nobody fits yet. Stay in line and we&apos;ll buzz you the second someone does.</p>

        {/* When people are around */}
        <div className="mt-4 rounded-[18px] bg-black/20 p-3">
          <p className="text-[12px] font-bold text-white/60">Busiest tonight</p>
          <div className="mt-2 flex h-14 items-end gap-1">
            {[2, 3, 3, 4, 6, 9, 12, 14, 13, 10, 6, 3].map((h, i) => (
              <span key={i} className={"flex-1 rounded-t-[4px] " + (i === 2 ? "bg-white" : i >= 6 && i <= 8 ? "bg-gold" : "bg-white/30")} style={{ height: `${h * 7}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] font-bold text-white/55">
            <span>6pm</span>
            <span className="text-gold">9–11pm</span>
            <span>2am</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="rounded-[16px] bg-white/12 p-3 text-[13px] font-semibold">
            <MapPin size={16} className="mb-1 text-gold" />
            Widen to all of Lagos
          </span>
          <span className="rounded-[16px] bg-white/12 p-3 text-[13px] font-semibold">
            <Users size={16} className="mb-1 text-gold" />
            Bring a friend · you both get 10 Keys
          </span>
        </div>
      </div>
      <HomeBelow />
      <Nav on={0} />
    </div>
  );
}

// 4. The moment your pair arrives (full screen, once)
function PairReveal() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center text-white" style={{ background: NIGHT }}>
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-gold/70" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, opacity: 0.15 + ((i * 7) % 10) / 30 }} />
      ))}
      <div className="relative z-10 w-full max-w-[340px]">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-gold uppercase">It&apos;s a pair</p>
        <div className="relative mx-auto mt-6 grid h-[150px] w-[150px] place-items-center">
          <span className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(242,179,61,0.55), transparent 70%)" }} />
          <span className="gm-burst">
            <Mask color={OWL.color} size={120} ring />
          </span>
        </div>
        <p className="mt-5 font-display text-[40px] leading-none font-black">{OWL.alias}</p>
        <p className="mt-2 text-[15px] text-white/75">
          {OWL.age} · {OWL.who} · {OWL.place}
        </p>
        <p className="mt-5 text-[13px] text-white/60">You both</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {OWL.common.map((c) => (
            <Chip key={c} tone="gold">
              ✓ {c}
            </Chip>
          ))}
        </div>

        <p className="mt-6 text-left text-[12px] font-bold text-white/60">Start with…</p>
        <div className="mt-2 space-y-2 text-left">
          {["Okay, rate my jollof standards out of 10 first 😤", "Tems on repeat? Which song is the one", "Best place on the Island for live music. Go."].map((t) => (
            <span key={t} className="block rounded-[16px] bg-white/12 px-3.5 py-2.5 text-[14px]">
              {t}
            </span>
          ))}
        </div>
        <span className="mt-5 block rounded-full bg-gold py-3.5 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">Say hi</span>
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <div className="border-b border-line bg-white">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <ChevronLeft size={24} />
        <Mask color={OWL.color} size={42} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">{OWL.alias}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {OWL.age} · {OWL.place} · tap for their vibe
          </span>
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full text-[12px] font-extrabold tabular-nums" style={{ background: "conic-gradient(#5b3fd9 0 70%, #efebfd 70% 100%)" }}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white">41m</span>
        </span>
        <MoreVertical size={20} className="text-muted" />
      </div>
      {/* Their vibe, always in view */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
        <Chip tone="gold">✨ 4 in common</Chip>
        {OWL.vibe.map((v) => (
          <Chip key={v}>{v}</Chip>
        ))}
      </div>
    </div>
  );
}

// 5. A masked chat: who they are (not what they look like), fun icebreakers, a clear way to unmask
function MaskedChat() {
  const msgs = [
    { me: false, t: "Ooh okay. Street food market, then a long walk with no plan 😄" },
    { me: true, t: "A walk with no plan is elite. Where would we end up?" },
    { me: false, t: "Somewhere with live music. You?" },
  ];
  return (
    <div className="flex h-dvh flex-col bg-cream text-ink">
      <ChatHeader />
      <div className="flex-1 space-y-2.5 overflow-hidden px-3 py-3">
        <p className="text-center text-[12px] text-muted">You&apos;re Golden Fox. Faces stay hidden until you both unmask.</p>
        {msgs.map((m, i) => (
          <div key={i} className={"flex " + (m.me ? "justify-end" : "")}>
            <span className={"max-w-[78%] rounded-[20px] px-3.5 py-2.5 text-[15px] " + (m.me ? "bg-brand text-white" : "bg-white")}>{m.t}</span>
          </div>
        ))}
        {/* A fun, local icebreaker you answer with a tap */}
        <div className="mx-auto max-w-[320px] rounded-[22px] bg-white p-3.5 text-center shadow-[0_10px_24px_-20px_rgba(20,10,40,0.5)] ring-2 ring-gold/50">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#8a5a00] uppercase">Both answer · then see</p>
          <p className="mt-1 text-[16px] font-semibold">Saturday night: owambe till 4am, or suya and a movie?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="rounded-full bg-brand-soft py-2.5 text-[14px] font-bold text-brand-ink">🎉 Owambe</span>
            <span className="rounded-full bg-brand-soft py-2.5 text-[14px] font-bold text-brand-ink">🍢 Suya &amp; movie</span>
          </div>
          <p className="mt-2 text-[12px] text-muted">Velvet Owl answered ✓</p>
        </div>
      </div>
      {/* Unmask, always clear */}
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-[20px] p-3 text-white" style={{ background: HERO }}>
        <span className="flex -space-x-2">
          <Mask color="#f2b33d" size={30} ring />
          <Mask color={OWL.color} size={30} ring />
        </span>
        <span className="min-w-0 flex-1 text-[13px] leading-snug">
          <b>Ready to see each other?</b>
          <br />
          <span className="text-white/70">Faces show only if you both say yes</span>
        </span>
        <span className="rounded-full bg-gold px-4 py-2 text-[14px] font-extrabold text-ink">Unmask</span>
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-white px-3 pt-2.5 pb-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-cream">
          <Plus size={20} />
        </span>
        <span className="flex-1 rounded-full bg-cream px-4 py-3 text-[15px] text-muted">Message</span>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white">
          <Mic size={20} />
        </span>
      </div>
    </div>
  );
}

// 6. Their masked profile: personality, not photos
function MaskedProfile() {
  return (
    <div className="relative h-dvh overflow-hidden bg-black/50">
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-hidden rounded-t-[32px] bg-cream px-5 pt-3 pb-8 text-ink">
        <span className="mx-auto block h-1.5 w-10 rounded-full bg-line-strong" />
        <div className="mt-4 flex items-center gap-3.5">
          <Mask color={OWL.color} size={72} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[28px] leading-tight font-black">{OWL.alias}</span>
            <span className="block text-[14px] text-muted">
              {OWL.age} · {OWL.who} · {OWL.place}
            </span>
          </span>
          <X size={22} className="text-muted" />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {OWL.vibe.map((v) => (
            <Chip key={v}>{v}</Chip>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-line">
          <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-gradient-to-br from-[#3a1240] to-[#e5484d] text-[20px]">🎧</span>
          <span className="flex-1">
            <span className="block text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">On repeat</span>
            <span className="block text-[15px] font-semibold">
              {OWL.song.title} · <span className="text-muted">{OWL.song.artist}</span>
            </span>
          </span>
        </div>

        <p className="mt-5 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">Things about me</p>
        <div className="mt-2 space-y-2">
          {OWL.things.map((t, i) => (
            <div key={t} className="flex gap-3 rounded-[18px] bg-white px-3.5 py-3 ring-1 ring-line">
              <span className="font-display text-[18px] font-black text-brand">{i + 1}</span>
              <span className="text-[14.5px]">{t}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">You both picked</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["Jollof", "Fried rice"],
            ["Calls", "Texts"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-[18px] bg-mint-soft p-3 text-center">
              <p className="text-[15px] font-bold text-[#137a52]">{a} ✓</p>
              <p className="text-[12px] text-muted">over {b}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
          <MaskIcon className="w-5" /> Photos and name show when you both unmask
        </p>
      </div>
    </div>
  );
}

// 7. Both said yes: the build-up
function UnmaskCountdown() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden text-center text-white" style={{ background: NIGHT }}>
      <div>
        <p className="text-[13px] font-extrabold tracking-[0.2em] text-gold uppercase">You both said yes</p>
        <div className="relative mx-auto mt-8 grid h-[220px] w-[220px] place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#f2b33d" strokeWidth="4" strokeDasharray="289" strokeDashoffset="96" strokeLinecap="round" />
          </svg>
          <span className="font-display text-[110px] leading-none font-black text-gold drop-shadow-[0_8px_0_rgba(0,0,0,0.3)]">2</span>
        </div>
        <div className="mt-8 flex items-center justify-center gap-6">
          <span className="text-center">
            <span className="block rotate-[-10deg]">
              <Mask color="#f2b33d" size={64} ring />
            </span>
            <span className="mt-2 block text-[13px] font-semibold text-white/80">You</span>
          </span>
          <Heart className="text-[#ff8a8a]" fill="#ff8a8a" size={26} />
          <span className="text-center">
            <span className="block rotate-[10deg]">
              <Mask color={OWL.color} size={64} ring />
            </span>
            <span className="mt-2 block text-[13px] font-semibold text-white/80">{OWL.alias}</span>
          </span>
        </div>
        <p className="mt-8 text-[15px] text-white/70">Masks off in…</p>
      </div>
    </div>
  );
}

// 8. The reveal
function UnmaskReveal() {
  return (
    <div className="relative min-h-dvh overflow-hidden text-white" style={{ background: NIGHT }}>
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className="absolute h-2.5 w-1.5 rounded-[2px]"
          style={{ left: `${(i * 41) % 100}%`, top: `${(i * 29) % 30}%`, background: ["#f2b33d", "#ff8a8a", "#7ad3a3", "#b49cff"][i % 4], transform: `rotate(${i * 37}deg)` }}
        />
      ))}
      <div className="relative z-10 flex min-h-dvh flex-col items-center px-6 pt-14 pb-10 text-center">
        <p className="text-[13px] font-extrabold tracking-[0.2em] text-gold uppercase">Masks off</p>
        <div className="relative mt-6 w-[230px]">
          <span
            className="block aspect-[4/5] w-full rounded-[32px] shadow-[0_0_0_4px_#f2b33d,0_30px_60px_-20px_rgba(0,0,0,0.7)]"
            style={{ background: "linear-gradient(160deg,#ffb38a 0%,#e5484d 55%,#7a1f3d 100%)" }}
          />
          <span className="absolute inset-0 grid place-items-center font-display text-[90px] font-black text-white/80">A</span>
          <span className="absolute -top-6 -left-8 rotate-[-25deg] opacity-90">
            <Mask color={OWL.color} size={70} />
          </span>
        </div>
        <p className="mt-6 text-[15px] text-white/70">{OWL.alias} is</p>
        <p className="font-display text-[48px] leading-none font-black">Ada, 26</p>
        <p className="mt-2 text-[14px] text-white/70">Lagos Island · 3 photos</p>
        <p className="mt-4 rounded-full bg-white/12 px-4 py-2 text-[13px] font-semibold">Your chat stays. She&apos;s now in Your people.</p>
        <div className="mt-auto grid w-full grid-cols-2 gap-2.5 pt-8">
          <span className="rounded-full bg-white/15 py-3.5 text-[15px] font-bold">See her photos</span>
          <span className="rounded-full bg-gold py-3.5 text-[15px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">Keep chatting</span>
        </div>
      </div>
    </div>
  );
}

// 9. Discover: masked people, personality first
function Discover() {
  const people = [
    { ...OWL, online: true },
    { alias: "Silver Hawk", age: 24, place: "Yaba", color: "#7ad3a3", vibe: ["📚 Bookworm", "🏋️ Gym"], song: { title: "Water", artist: "Tyla" }, common: ["Gym", "Yaba"], online: true },
    { alias: "Coral Lynx", age: 29, place: "Lekki", color: "#b49cff", vibe: ["✈️ Traveller", "📸 Photos"], song: { title: "Rush", artist: "Ayra Starr" }, common: ["Travel"], online: false },
    { alias: "Amber Fox", age: 27, place: "Surulere", color: "#f2b33d", vibe: ["⚽ Football", "🍳 Cooks"], song: { title: "Calm Down", artist: "Rema" }, common: ["Football", "Cooking", "Surulere"], online: true },
  ];
  return (
    <div className="min-h-dvh bg-cream px-4 pt-5 pb-28 text-ink">
      <h1 className="font-display text-[34px] font-black">Discover</h1>
      <p className="mt-1 text-[14px] text-muted">People who fit you, masked. Faces show when you both unmask.</p>
      <div className="mt-4 flex gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] text-muted ring-1 ring-line">
          <Search size={17} /> Search a vibe: foodie, gym…
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {people.map((p) => (
          <div key={p.alias} className="flex flex-col rounded-[24px] bg-white p-3.5 shadow-[0_10px_24px_-20px_rgba(20,10,40,0.45)] ring-1 ring-line">
            <div className="flex items-start justify-between">
              <span className="relative">
                <Mask color={p.color} size={52} />
                {p.online && <span className="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full bg-mint ring-2 ring-white" />}
              </span>
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-extrabold text-[#8a5a00]">{p.common.length} in common</span>
            </div>
            <p className="mt-2 text-[15.5px] font-bold">{p.alias}</p>
            <p className="text-[12.5px] text-muted">
              {p.age} · {p.place}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.vibe.slice(0, 2).map((v) => (
                <span key={v} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">
                  {v}
                </span>
              ))}
            </div>
            <p className="mt-2 truncate text-[12px] text-muted">🎧 {p.song.title}</p>
            <span className="mt-3 rounded-full bg-brand py-2 text-center text-[13px] font-bold text-white">Say hi masked</span>
          </div>
        ))}
      </div>
      <Nav on={1} />
    </div>
  );
}

// 10. Chats: masked now on top, your people below
function Chats() {
  return (
    <div className="min-h-dvh bg-cream px-4 pt-5 pb-28 text-ink">
      <h1 className="font-display text-[34px] font-black">Chats</h1>

      <div className="mt-4 rounded-[26px] p-3 text-white" style={{ background: HERO }}>
        <p className="px-1 text-[12px] font-extrabold tracking-[0.14em] text-gold uppercase">Masked now</p>
        {[
          { a: OWL.alias, c: OWL.color, m: "Somewhere with live music. You?", t: "41m", un: true },
          { a: "Misty Moth", c: "#3aa0c8", m: "You: Voice note", t: "53m", un: false },
        ].map((x) => (
          <div key={x.a} className="mt-2 flex items-center gap-3 rounded-[18px] bg-white/10 p-2.5">
            <Mask color={x.c} size={46} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{x.a}</span>
              <span className={"block truncate text-[13px] " + (x.un ? "font-semibold text-white" : "text-white/65")}>{x.m}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11.5px] font-bold">
                <Clock size={12} /> {x.t}
              </span>
              {x.un && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 text-[12px] font-extrabold tracking-[0.14em] text-muted uppercase">Your people</p>
      {[
        { n: "Ada", c: "from-[#ff9a6b] to-[#e5484d]", m: "When the conversation just flows…", t: "3m", un: true },
        { n: "Kemi", c: "from-[#7ad3a3] to-[#1f9d6b]", m: "You: Haha see you Saturday!", t: "2h" },
        { n: "Zara", c: "from-[#b49cff] to-[#5b3fd9]", m: "You unmasked! Say hello", t: "5h" },
      ].map((x) => (
        <div key={x.n} className="mb-2 flex items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-line">
          <span className={"grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-[17px] font-bold text-white " + x.c}>{x.n[0]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{x.n}</span>
            <span className={"block truncate text-[13px] " + (x.un ? "font-semibold text-ink" : "text-muted")}>{x.m}</span>
          </span>
          <span className="flex flex-col items-end gap-1 text-[12px] text-muted">
            {x.t}
            {x.un && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
          </span>
        </div>
      ))}
      <Nav on={2} />
    </div>
  );
}

// 11. Free at the magic moments, Keys for extras
function KeysFair() {
  return (
    <div className="min-h-dvh bg-cream px-4 pt-5 pb-28 text-ink">
      <h1 className="font-display text-[30px] font-black">Missed connections</h1>
      <p className="mt-1 text-[14px] text-muted">The hour ran out before you both decided. Pick it back up.</p>
      {[
        { a: "Quiet Heron", c: "#5b3fd9", s: "28 · Man · you both liked the chat", free: true },
        { a: "Wild Comet", c: "#127a8a", s: "25 · Man · yesterday", free: false },
      ].map((x) => (
        <div key={x.a} className="mt-3 flex items-center gap-3 rounded-[22px] bg-white p-3.5 ring-1 ring-line">
          <Mask color={x.c} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{x.a}</span>
            <span className="block truncate text-[12.5px] text-muted">{x.s}</span>
          </span>
          {x.free ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3.5 py-2 text-[13px] font-bold text-white">
              <RotateCcw size={14} /> Reconnect free
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-3.5 py-2 text-[13px] font-bold text-[#8a5a00] ring-1 ring-gold/40">
              <KeyCoin size={16} /> 5
            </span>
          )}
        </div>
      ))}
      <p className="mt-2 text-center text-[12px] text-muted">1 free reconnect a week · next one after that is 5 Keys</p>

      <div className="mt-7 rounded-[26px] bg-white p-4 ring-1 ring-line">
        <p className="text-[16px] font-bold">Always free</p>
        <div className="mt-2 space-y-2 text-[14px]">
          {["Your masked pair, every hour", "Chatting, voice notes, unmasking", "Your first reconnect each week"].map((t) => (
            <p key={t} className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-mint text-[11px] font-black text-white">✓</span>
              {t}
            </p>
          ))}
        </div>
        <p className="mt-5 text-[16px] font-bold">Keys are for extras</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { i: <Sparkles size={18} />, t: "A pair right now", k: 3 },
            { i: <Clock size={18} />, t: "+30 min chat", k: 2 },
            { i: <Gift size={18} />, t: "Send a gift", k: 1 },
            { i: <ChevronRight size={18} />, t: "Boost: first in Discover", k: 5 },
          ].map((x) => (
            <span key={x.t} className="rounded-[18px] bg-cream p-3">
              <span className="text-brand">{x.i}</span>
              <span className="mt-1 block text-[13.5px] font-semibold">{x.t}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#8a5a00]">
                <KeyCoin size={14} /> {x.k}
              </span>
            </span>
          ))}
        </div>
      </div>
      <Nav on={0} />
    </div>
  );
}

export function CoreMock({ step }: { step: number }) {
  const screens = [HomeWaiting, HomeArrived, HomeQuiet, PairReveal, MaskedChat, MaskedProfile, UnmaskCountdown, UnmaskReveal, Discover, Chats, KeysFair];
  const S = screens[step - 1] ?? HomeWaiting;
  return <S />;
}
