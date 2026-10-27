"use client";

// Design previews: hiding the main photo with an "Aura" (its colours, no shapes), an optional
// no-face teaser photo that unlocks piece by piece as you chat, and the Friends unmask pop-up.
// Static sample screens (new-aura-1 … new-aura-5); not wired up.
import { ArrowRight, Camera, ChevronLeft, Lock, Phone, Mic, MoreVertical, Plus, Search, Sparkles, UserRound, Users, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";

/** A person's colours, as if taken from their main photo */
type Palette = { name: string; c: [string, string, string, string] };
const SUNSET: Palette = { name: "Sunset", c: ["#ff8a3d", "#e5484d", "#7a1f3d", "#ffd36b"] };
const OCEAN: Palette = { name: "Ocean", c: ["#3ab0d8", "#1d4e89", "#9fe0e8", "#0b2545"] };
const GARDEN: Palette = { name: "Garden", c: ["#7ad3a3", "#1f6b4a", "#e8d36b", "#0f3b2a"] };
const NEON: Palette = { name: "Neon night", c: ["#b44cff", "#2b1d73", "#ff4fa3", "#120b2e"] };
const GOLD: Palette = { name: "Golden hour", c: ["#f2b33d", "#b9651e", "#fff1c9", "#6b3410"] };
const BLUSH: Palette = { name: "Blush", c: ["#ffb3c7", "#c2577a", "#fff0f4", "#7a2e4f"] };

const NIGHT = "radial-gradient(100% 60% at 50% 30%, #5b3fd9 0%, #2b1d73 45%, #120b2e 100%)";

/**
 * Their Aura: soft blobs of the colours in their photo, mixed differently for everyone
 * (the seed moves the blobs), with a fine grain so it looks like art, not a blur.
 */
function Aura({ p, seed = 1, mask = true, rounded = "rounded-[28px]", className = "", maskSize = 0.42 }: { p: Palette; seed?: number; mask?: boolean; rounded?: string; className?: string; maskSize?: number }) {
  const pos = (k: number) => `${20 + ((seed * 37 + k * 53) % 60)}% ${15 + ((seed * 29 + k * 41) % 70)}%`;
  const bg = [
    `radial-gradient(60% 55% at ${pos(1)}, ${p.c[0]} 0%, transparent 70%)`,
    `radial-gradient(55% 60% at ${pos(2)}, ${p.c[2]}cc 0%, transparent 70%)`,
    `radial-gradient(70% 65% at ${pos(3)}, ${p.c[1]} 0%, transparent 75%)`,
    `conic-gradient(from ${seed * 47}deg at 50% 50%, ${p.c[3]}, ${p.c[1]}, ${p.c[0]}, ${p.c[3]})`,
  ].join(",");
  return (
    <span className={"relative block overflow-hidden " + rounded + " " + className} style={{ background: bg }}>
      {/* Grain */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.22] mix-blend-overlay" aria-hidden>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
      {/* Swirl of light */}
      <span className="absolute -inset-1/4 opacity-40" style={{ background: `conic-gradient(from ${seed * 90}deg, transparent 0 20%, rgba(255,255,255,0.35) 28%, transparent 40% 70%, rgba(255,255,255,0.2) 78%, transparent 90%)`, filter: "blur(18px)" }} />
      {mask && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="block drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" style={{ width: `${maskSize * 100}%` }}>
            <MaskIcon className="w-full text-[#1c1828]/85" eyes={p.c[0]} />
          </span>
        </span>
      )}
    </span>
  );
}

/** A stand-in for someone's real main photo (only they and their matches ever see this) */
function PortraitArt({ p }: { p: Palette }) {
  return (
    <svg viewBox="0 0 120 150" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`sky-${p.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.c[3]} />
          <stop offset="0.6" stopColor={p.c[0]} />
          <stop offset="1" stopColor={p.c[2]} />
        </linearGradient>
      </defs>
      <rect width="120" height="150" fill={`url(#sky-${p.name})`} />
      <circle cx="88" cy="40" r="14" fill={p.c[2]} opacity="0.9" />
      <path d="M20 150c4-34 20-50 40-50s36 16 40 50Z" fill={p.c[1]} />
      <circle cx="60" cy="70" r="20" fill="#8a5a3c" />
      <path d="M38 66c0-18 10-28 22-28s22 10 22 28c-4-8-12-12-22-12s-18 4-22 12Z" fill="#1c1828" />
    </svg>
  );
}

/** The no-face teaser photo they chose: a drink at sunset by the water */
function TeaserArt() {
  return (
    <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1f6b" />
          <stop offset="0.45" stopColor="#e5484d" />
          <stop offset="0.7" stopColor="#ffb36b" />
        </linearGradient>
        <linearGradient id="t-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#3b1f6b" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#t-sky)" />
      <circle cx="200" cy="168" r="34" fill="#ffd36b" />
      <rect y="190" width="300" height="110" fill="url(#t-sea)" />
      {[205, 222, 240, 258].map((y, i) => (
        <rect key={y} x={150 + i * 8} y={y} width={90 - i * 14} height="3" rx="1.5" fill="#ffd36b" opacity={0.7 - i * 0.12} />
      ))}
      {/* Palm */}
      <path d="M40 300 C44 240 50 200 62 150" stroke="#1c1020" strokeWidth="7" fill="none" />
      <path d="M62 150c-20-6-40 2-52 14 18-6 34-6 52-14Zm0 0c-4-20-20-32-36-34 12 10 22 20 36 34Zm0 0c14-16 34-20 50-16-18 2-34 8-50 16Zm0 0c18-4 36 4 44 18-14-8-28-12-44-18Z" fill="#1c1020" />
      {/* Hand holding a glass */}
      <path d="M196 300c0-30 6-52 20-62l30-6c10 4 14 14 10 24l-16 44Z" fill="#7a4a30" />
      <path d="M200 150h70l-12 74h-46Z" fill="#ffffff" opacity="0.28" stroke="#fff" strokeWidth="3" />
      <path d="M205 176h60l-8 46h-44Z" fill="#ff6b3d" opacity="0.85" />
      <circle cx="252" cy="150" r="10" fill="#ffd36b" />
      <path d="M226 150l18-46" stroke="#1f9d6b" strokeWidth="4" strokeLinecap="round" />
      <path d="M212 232c8 4 22 4 32 0" stroke="#5a341f" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Chip({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" | "gold" }) {
  const t = tone === "dark" ? "bg-white/15 text-white" : tone === "gold" ? "bg-gold-soft text-[#8a5a00]" : "bg-brand-soft text-brand-ink";
  return <span className={"inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap " + t}>{children}</span>;
}

// 1. How an Aura is made, and why no two look alike
function HowItWorks() {
  const all = [SUNSET, OCEAN, GARDEN, NEON, GOLD, BLUSH];
  return (
    <div className="min-h-dvh bg-cream px-5 pt-6 pb-10 text-ink">
      <p className="text-[12px] font-extrabold tracking-[0.16em] text-brand uppercase">Your Aura</p>
      <h1 className="mt-1 font-display text-[30px] leading-[1.1] font-black">Your photo, as colour</h1>
      <p className="mt-2 text-[14.5px] text-muted">While you&apos;re masked, people see the colours of your main photo, never your face. It&apos;s made from your real photo, so it&apos;s yours alone.</p>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1">
          <span className="block aspect-[4/5] overflow-hidden rounded-[22px] ring-1 ring-line">
            <PortraitArt p={SUNSET} />
          </span>
          <p className="mt-2 text-center text-[12px] font-semibold text-muted">Your main photo</p>
          <p className="text-center text-[11px] text-muted">Only shows when you unmask</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
          <ArrowRight size={20} />
        </span>
        <div className="flex-1">
          <Aura p={SUNSET} seed={3} className="aspect-[4/5]" rounded="rounded-[22px]" />
          <p className="mt-2 text-center text-[12px] font-semibold text-muted">Your Aura</p>
          <p className="text-center text-[11px] text-muted">What masked people see</p>
        </div>
      </div>

      <p className="mt-7 text-[12px] font-extrabold tracking-[0.14em] text-muted uppercase">Every photo makes a different Aura</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {all.map((p, i) => (
          <div key={p.name}>
            <Aura p={p} seed={i + 2} className="aspect-square" rounded="rounded-[20px]" maskSize={0.5} />
            <p className="mt-1 text-center text-[11.5px] font-semibold text-muted">{p.name}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 rounded-[18px] bg-brand-soft px-4 py-3 text-[13px] text-brand-ink">
        <b>No blur, no shapes.</b> Nobody can work out who you are from your Aura, not even people who know you.
      </p>
    </div>
  );
}

// 2. Discover with Auras
function DiscoverAuras() {
  const people = [
    { a: "Velvet Owl", age: 26, place: "Lagos Island", p: SUNSET, v: ["🌙 Night owl", "🍲 Foodie"], common: 4, teaser: true, online: true },
    { a: "Silver Hawk", age: 24, place: "Yaba", p: OCEAN, v: ["📚 Books", "🏋️ Gym"], common: 2, teaser: false, online: true },
    { a: "Coral Lynx", age: 29, place: "Lekki", p: BLUSH, v: ["✈️ Travel", "📸 Photos"], common: 1, teaser: true, online: false },
    { a: "Amber Fox", age: 27, place: "Surulere", p: GOLD, v: ["⚽ Football", "🍳 Cooks"], common: 3, teaser: false, online: true },
  ];
  return (
    <div className="min-h-dvh bg-cream px-4 pt-5 pb-28 text-ink">
      <h1 className="font-display text-[34px] font-black">Meet</h1>
      <p className="mt-1 text-[14px] text-muted">People who fit you, masked. Faces show when you both unmask.</p>
      <span className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] text-muted ring-1 ring-line">
        <Search size={17} /> Search by name
      </span>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {people.map((x, i) => (
          <div key={x.a} className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_24px_-20px_rgba(20,10,40,0.45)] ring-1 ring-line">
            <span className="relative block">
              <Aura p={x.p} seed={i + 2} className="aspect-[4/5]" rounded="rounded-none" maskSize={0.46} />
              {x.online && (
                <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Online
                </span>
              )}
              {x.teaser && (
                <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur" aria-label="Has a teaser photo">
                  <Camera size={14} />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2.5 text-white">
                <span className="block text-[15.5px] font-bold">{x.a}</span>
                <span className="block text-[12px] text-white/85">
                  {x.age} · {x.place}
                </span>
              </span>
            </span>
            <span className="block px-3 pt-2.5 pb-3">
              <span className="flex flex-wrap gap-1">
                {x.v.map((v) => (
                  <span key={v} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">
                    {v}
                  </span>
                ))}
              </span>
              <span className="mt-2 block text-[11.5px] font-bold text-[#8a5a00]">✨ {x.common} in common</span>
            </span>
          </div>
        ))}
      </div>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-line bg-white/95 pt-2 pb-3">
        {[
          { l: "Home", i: <MaskIcon className="w-[26px]" /> },
          { l: "Meet", i: <Users size={22} /> },
          { l: "Chats", i: <Sparkles size={22} /> },
          { l: "Profile", i: <UserRound size={22} /> },
        ].map((x, i) => (
          <span key={x.l} className={"flex flex-1 flex-col items-center gap-1 text-[11.5px] font-semibold " + (i === 1 ? "text-brand" : "text-muted")}>
            {x.i}
            {x.l}
          </span>
        ))}
      </nav>
    </div>
  );
}

// 3. The pair pop-up, with their Aura
function PairPopAura() {
  return (
    <div className="fixed inset-0 z-50 bg-[#120b2e]/70 backdrop-blur-[3px]">
      <div className="absolute inset-x-3 top-11 bottom-3 flex flex-col overflow-hidden rounded-[34px] text-center text-white shadow-[0_0_0_2px_rgba(242,179,61,0.55)]" style={{ background: NIGHT }}>
        <div className="relative flex justify-center px-4 pt-4">
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
          <span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/12">
            <X size={20} />
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center overflow-hidden px-6 pt-3">
          <p className="text-[12px] font-extrabold tracking-[0.2em] text-gold uppercase">Your pair is here</p>
          <div className="relative mt-5">
            <span className="absolute -inset-5 rounded-[40px]" style={{ background: "radial-gradient(circle, rgba(255,138,61,0.55), transparent 70%)" }} />
            <Aura p={SUNSET} seed={3} className="h-[200px] w-[160px] shadow-[0_0_0_3px_#fff]" rounded="rounded-[30px]" maskSize={0.5} />
          </div>
          <p className="mt-5 font-display text-[36px] leading-none font-black">Velvet Owl</p>
          <p className="mt-2 text-[15px] text-white/75">26 · Woman · Lagos Island</p>
          <p className="mt-4 text-[12.5px] font-semibold text-white/60">You both</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {["Afrobeats", "Foodie", "Night owl", "Island person"].map((c) => (
              <Chip key={c} tone="gold">
                ✓ {c}
              </Chip>
            ))}
          </div>
          <div className="mt-4 flex w-full items-center gap-3 rounded-[18px] bg-white/10 px-3 py-2.5 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/15">
              <Camera size={18} className="text-gold" />
            </span>
            <span className="text-[13px] leading-snug">
              <b>She has a teaser photo.</b>
              <br />
              <span className="text-white/70">It unlocks piece by piece as you chat</span>
            </span>
          </div>
        </div>
        <div className="grid gap-2 px-5 pt-4 pb-5">
          <span className="rounded-full bg-gold py-4 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">
            Say hi <span className="text-[13px] font-bold text-ink/60">· 60 min to chat</span>
          </span>
          <span className="py-1 text-[13.5px] font-semibold text-white/60">Later</span>
        </div>
      </div>
    </div>
  );
}

// 4. In the chat: their teaser photo, unlocking piece by piece
function TeaserInChat() {
  const open = [0, 2, 4, 5, 7];
  return (
    <div className="flex h-dvh flex-col bg-cream text-ink">
      <div className="flex items-center gap-2.5 border-b border-line bg-white px-3 py-2.5">
        <ChevronLeft size={24} />
        <Aura p={SUNSET} seed={3} className="h-11 w-11" rounded="rounded-full" maskSize={0.62} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Velvet Owl</span>
          <span className="block text-[12.5px] text-mint">Online · 26 · Woman</span>
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full text-[12px] font-extrabold" style={{ background: "conic-gradient(#5b3fd9 0 70%, #efebfd 70% 100%)" }}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white">41m</span>
        </span>
        <MoreVertical size={20} className="text-muted" />
      </div>

      <div className="flex-1 space-y-2.5 overflow-hidden px-3 py-3">
        <div className="flex">
          <span className="max-w-[78%] rounded-[20px] bg-white px-3.5 py-2.5 text-[15px]">Somewhere with live music. You?</span>
        </div>
        <div className="flex justify-end">
          <span className="max-w-[78%] rounded-[20px] bg-brand px-3.5 py-2.5 text-[15px] text-white">Same, but I&apos;m judging the jollof at every stop</span>
        </div>

        {/* The teaser card */}
        <div className="mx-auto w-[260px] rounded-[26px] bg-white p-3 shadow-[0_14px_30px_-20px_rgba(20,10,40,0.5)] ring-1 ring-line">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <Camera size={15} className="text-brand" /> Her teaser photo
            </span>
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11.5px] font-extrabold text-[#8a5a00]">5 of 9</span>
          </div>
          <div className="relative mt-2.5 grid aspect-square grid-cols-3 gap-[3px] overflow-hidden rounded-[18px]">
            {Array.from({ length: 9 }, (_, i) => {
              const on = open.includes(i);
              const x = (i % 3) * 50;
              const y = Math.floor(i / 3) * 50;
              return (
                <span key={i} className="relative overflow-hidden">
                  {on ? (
                    <span className={"absolute inset-0 " + (i === 7 ? "gm-burst" : "")}>
                      <span className="absolute h-[300%] w-[300%]" style={{ left: `-${x * 2}%`, top: `-${y * 2}%` }}>
                        <TeaserArt />
                      </span>
                    </span>
                  ) : (
                    <span className="absolute inset-0">
                      <Aura p={SUNSET} seed={i + 9} mask={false} rounded="rounded-none" className="h-full w-full" />
                    </span>
                  )}
                  {!on && (
                    <span className="absolute inset-0 grid place-items-center">
                      <Lock size={16} className="text-white/85" />
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <p className="mt-2.5 text-center text-[12.5px] text-muted">
            <b className="text-ink">New piece</b> every 10 messages · next in 4
          </p>
        </div>
        <p className="text-center text-[12px] font-semibold text-brand">✨ A piece just unlocked</p>
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

// 5. Unmasking for Friends: connected, not a "match"
function FriendsConnected() {
  return (
    <div className="fixed inset-0 z-50 bg-[#0b2a1d]/70 backdrop-blur-[3px]">
      <div
        className="absolute inset-x-3 top-11 bottom-3 flex flex-col overflow-hidden rounded-[34px] text-center text-white shadow-[0_0_0_2px_rgba(122,211,163,0.6)]"
        style={{ background: "radial-gradient(100% 60% at 50% 30%, #2a8a5c 0%, #17663f 45%, #0b2a1d 100%)" }}
      >
        <div className="relative flex justify-center px-4 pt-4">
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
          <span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/12">
            <X size={20} />
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center px-6 pt-3">
          <p className="text-[12px] font-extrabold tracking-[0.2em] text-[#ffd36b] uppercase">You&apos;re connected</p>
          <div className="relative mt-7 flex items-center justify-center">
            <span className="relative z-10 -mr-4 block h-[120px] w-[120px] rounded-full shadow-[0_0_0_4px_#fff]" style={{ background: "linear-gradient(160deg,#ffb38a 0%,#c2410c 100%)" }}>
              <span className="grid h-full place-items-center font-display text-[48px] font-black text-white/85">T</span>
            </span>
            <span className="relative z-20 block h-[120px] w-[120px] rounded-full shadow-[0_0_0_4px_#fff]" style={{ background: "linear-gradient(160deg,#9fe0e8 0%,#1d4e89 100%)" }}>
              <span className="grid h-full place-items-center font-display text-[48px] font-black text-white/85">K</span>
            </span>
            <span className="absolute -bottom-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-white text-[24px] shadow-lg">🤝</span>
          </div>
          <p className="mt-9 text-[15px] text-white/70">Silver Hawk is</p>
          <p className="font-display text-[44px] leading-none font-black">Kunle, 24</p>
          <p className="mt-2 text-[14px] text-white/70">Yaba · new friend</p>
          <div className="mt-5 w-full rounded-[18px] bg-white/10 p-3.5 text-left">
            <p className="text-[12px] font-bold text-white/60">What you two have</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Football", "Gym", "Yaba", "Amapiano"].map((c) => (
                <Chip key={c} tone="dark">
                  {c}
                </Chip>
              ))}
            </div>
          </div>
          <p className="mt-4 rounded-full bg-white/12 px-4 py-2 text-[13px] font-semibold">Your chat stays. Kunle is now in Your people.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pb-5">
          <span className="flex items-center justify-center gap-1.5 rounded-full bg-white/15 py-3.5 text-[15px] font-bold">
            <Phone size={16} /> Call
          </span>
          <span className="rounded-full bg-[#ffd36b] py-3.5 text-[15px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">Keep chatting</span>
        </div>
      </div>
    </div>
  );
}

export function AuraMock({ step }: { step: number }) {
  const screens = [HowItWorks, DiscoverAuras, PairPopAura, TeaserInChat, FriendsConnected];
  const S = screens[step - 1] ?? HowItWorks;
  return <S />;
}
