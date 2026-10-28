"use client";

// Design previews for the Daily game (one Word Hunt board a day, same for everyone, streaks).
// Static sample screens; not wired up.
import { ChevronLeft, Clock, Share2, Trophy, Users, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";

const BG = "radial-gradient(120% 60% at 50% 0%, #2f7a4a 0%, #123822 60%, #07180f 100%)";
const BOARD = "SRTAVIBEAREBNEST";
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function Flame({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="dl-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#ff6b3d" />
        </linearGradient>
      </defs>
      <path d="M12 1.5c1.5 4 7 6 7 12.5a7 7 0 0 1-14 0c0-3.2 1.6-5 3-6.4.3 2 1.2 3.3 2.5 3.9C9.8 7.5 11 4.2 12 1.5Z" fill="url(#dl-flame)" />
      <path d="M12 12.5c.9 1.8 3.2 2.7 3.2 5.2a3.2 3.2 0 0 1-6.4 0c0-1.6 1-2.6 1.9-3.3.2.8.6 1.3 1.2 1.5-.3-1.4 0-2.5.1-3.4Z" fill="#fff4c9" />
    </svg>
  );
}

/** This week: a dot per day, lit if you played */
function Week({ played, today }: { played: number; today: number }) {
  return (
    <div className="flex justify-center gap-2">
      {WEEK.map((d, i) => (
        <span key={i} className="flex flex-col items-center gap-1">
          <span
            className={
              "grid h-8 w-8 place-items-center rounded-full text-[12px] font-black " +
              (i < played ? "bg-gradient-to-b from-[#ffd36b] to-[#ff8a3d] text-ink" : i === today ? "bg-white/15 text-white ring-2 ring-gold" : "bg-white/8 text-white/35")
            }
          >
            {i < played ? "✓" : d}
          </span>
        </span>
      ))}
    </div>
  );
}

function Board({ path = [] as number[], small = false }) {
  return (
    <div
      className={"relative rounded-[28px] " + (small ? "p-2" : "p-3.5")}
      style={{ background: "linear-gradient(180deg, #1f9d6b 0%, #137a52 100%)", boxShadow: "0 10px 0 #0a4a32, 0 30px 60px -20px rgba(31,157,107,0.7)" }}
    >
      <div className="relative grid grid-cols-4">
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden>
          {path.length > 1 && (
            <polyline
              points={path.map((i) => `${12.5 + (i % 4) * 25},${12.5 + Math.floor(i / 4) * 25}`).join(" ")}
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
          )}
        </svg>
        {BOARD.split("").map((ch, i) => {
          const on = path.includes(i);
          return (
            <div key={i} className={small ? "p-[3px]" : "p-[5px]"}>
              <span
                className={"grid aspect-square place-items-center rounded-[18px] font-extrabold " + (small ? "text-[20px] rounded-[12px] " : "text-[32px] ") + (on ? "bg-gold text-ink" : "bg-[#fdfbf6] text-[#0b3a2a]")}
                style={{ boxShadow: on ? "0 6px 0 #b9831e, 0 0 0 3px #ffffff" : small ? "0 4px 0 #c9c1b2" : "0 6px 0 #c9c1b2" }}
              >
                <span className="relative z-20">{ch}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DailyMock({ step }: { step: 1 | 2 | 3 | 4 }) {
  if (step === 1) return <Entry />;
  if (step === 2) return <Playing />;
  if (step === 3) return <Done />;
  return <ShareCard />;
}

/** 1. On the Home / Play screen: today's game, your streak */
function Entry() {
  return (
    <div className="min-h-dvh bg-[#0f0a1a] px-4 pt-5 pb-8 text-white">
      <p className="text-[13px] font-semibold text-white/55">Good morning, Tobi</p>
      <h1 className="font-display text-[28px] font-black">Home</h1>

      <div className="relative mt-5 overflow-hidden rounded-[28px] p-5" style={{ background: BG, boxShadow: "0 20px 50px -20px rgba(31,157,107,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
        {/* Little letter tiles in the corner */}
        <div className="absolute -top-4 -right-4 grid rotate-12 grid-cols-2 gap-1 opacity-80">
          {["W", "O", "R", "D"].map((l) => (
            <span key={l} className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#fdfbf6] text-[16px] font-extrabold text-[#0b3a2a] shadow-[0_4px_0_#c9c1b2]">
              {l}
            </span>
          ))}
        </div>
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-gold uppercase">Daily · #42</p>
        <p className="mt-1 max-w-[230px] font-display text-[30px] leading-[1.05] font-black">Today&apos;s Word Hunt</p>
        <p className="mt-1.5 max-w-[220px] text-[14px] text-white/75">Same 16 letters for everyone. 90 seconds. One go.</p>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5">
            <Flame size={20} />
            <span className="text-[15px] font-black">12</span>
            <span className="text-[12px] font-semibold text-white/70">day streak</span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
            <Users size={15} /> 214 played today
          </span>
        </div>

        <div className="mt-4">
          <Week played={4} today={4} />
        </div>

        <button type="button" className="gm-btn mt-5 w-full rounded-full bg-gradient-to-b from-[#ffd36b] to-gold py-3.5 font-display text-[19px] font-black text-ink shadow-[0_6px_0_#b9831e]">
          Play today&apos;s
        </button>
        <p className="mt-2.5 text-center text-[12px] text-white/60">Don&apos;t lose your streak · 6h 12m left today</p>
      </div>

      <p className="mt-6 text-[12px] font-extrabold tracking-[0.12em] text-white/50 uppercase">Tonight</p>
      <div className="mt-2 rounded-[22px] bg-white/6 p-4 ring-1 ring-white/8">
        <p className="text-[12px] font-bold text-white/55">Today&apos;s prompt · from 7pm</p>
        <p className="mt-1 text-[16px] font-semibold">“What&apos;s the most Lagos thing you did this week?”</p>
      </div>
    </div>
  );
}

/** 2. Playing: the same board as Word Hunt, against the clock, not a person */
function Playing() {
  return (
    <div className="gm-arena relative flex h-dvh flex-col overflow-hidden px-[18px] text-white" style={{ background: BG }}>
      <div className="flex items-center gap-2 pt-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <ChevronLeft size={20} />
        </span>
        <span className="flex flex-1 justify-center">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-extrabold tracking-[0.14em] text-gold uppercase">Daily #42</span>
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <X size={19} />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-gold">SCORE</p>
          <p className="font-display text-[34px] leading-none font-bold tabular-nums">2,400</p>
          <p className="text-[12px] text-white/65">6 words</p>
        </div>
        <div className="grid h-[74px] w-[74px] place-items-center rounded-full" style={{ background: "conic-gradient(#f2b33d 0 62%, rgba(255,255,255,0.12) 62% 100%)" }}>
          <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-[#0b3a2a] text-[18px] font-extrabold tabular-nums">0:56</span>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/60 uppercase">To beat</p>
          <p className="font-display text-[24px] leading-[1.1] font-bold text-[#c4b5fd] tabular-nums">3,100</p>
          <p className="text-[12px] text-white/65">Your best</p>
        </div>
      </div>

      <div className="mt-5 flex h-12 items-center justify-center">
        <span className="gm-burst rounded-full bg-white px-5 py-2 font-display text-[22px] font-black tracking-[0.12em] text-[#0b3a2a]">
          BRAVE<span className="ml-1.5 text-[14px] tracking-normal text-[#1f9d6b]">+800</span>
        </span>
      </div>

      <div className="mt-4">
        <Board path={[4, 5, 6, 7, 2]} />
      </div>

      <p className="mt-5 text-[12px] font-extrabold tracking-[0.12em] text-white/60">YOUR WORDS</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["BEAR", "RATE", "BRAVEST", "TEAR", "STAR", "NEST"].map((w) => (
          <span key={w} className="rounded-full bg-white/12 px-2.5 py-1 text-[13px] font-bold tracking-wide">
            {w}
          </span>
        ))}
      </div>
      <p className="mt-auto pb-6 text-center text-[12px] text-white/55">Everyone gets these letters today. No one else needs to be online.</p>
    </div>
  );
}

/** 3. Finished: your rank today, your streak, share */
function Done() {
  return (
    <div className="gm-arena relative flex min-h-dvh flex-col overflow-hidden px-5 pb-8 text-white" style={{ background: BG }}>
      <div className="flex items-center justify-between pt-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <ChevronLeft size={20} />
        </span>
        <span className="text-[13px] font-extrabold tracking-[0.14em] text-gold uppercase">Daily #42 · done</span>
        <span className="w-10" />
      </div>

      <div className="mt-5 text-center">
        <span className="gm-burst inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ffd36b] to-[#ff8a3d] px-4 py-1.5 font-display text-[18px] font-black text-ink shadow-[0_5px_0_#b85a1e]">
          <Flame size={22} /> 13 day streak!
        </span>
        <p className="mt-4 font-display text-[56px] leading-none font-black tabular-nums">3,400</p>
        <p className="mt-1 text-[14px] text-white/70">9 words · new personal best</p>
      </div>

      {/* Where you placed today */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] bg-black/25 p-3.5 text-center">
          <Trophy className="mx-auto text-gold" size={22} />
          <p className="mt-1 font-display text-[26px] font-black">#4</p>
          <p className="text-[12px] text-white/65">of 214 today</p>
        </div>
        <div className="rounded-[20px] bg-black/25 p-3.5 text-center">
          <p className="mt-1 font-display text-[26px] font-black text-mint">Top 5%</p>
          <p className="text-[12px] text-white/65">You beat 203 people</p>
          <p className="mt-0.5 text-[11px] font-bold text-gold">#2 in Lagos</p>
        </div>
      </div>

      {/* Today's top 3, masked */}
      <p className="mt-5 text-[12px] font-extrabold tracking-[0.12em] text-white/55 uppercase">Today&apos;s best · masked</p>
      <div className="mt-2 space-y-1.5">
        {[
          { n: 1, name: "Velvet Fox", s: "4,100", c: "#f2b33d" },
          { n: 2, name: "Silver Hawk", s: "3,900", c: "#a78bfa" },
          { n: 3, name: "Coral Lynx", s: "3,600", c: "#ff8a8a" },
          { n: 4, name: "You", s: "3,400", c: "#4ade80", me: true },
        ].map((r) => (
          <div key={r.n} className={"flex items-center gap-3 rounded-[16px] px-3 py-2 " + (r.me ? "bg-white/15 ring-2 ring-gold" : "bg-white/6")}>
            <span className="w-4 text-center text-[14px] font-black text-white/60">{r.n}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: r.c }}>
              <MaskIcon className="w-5 text-ink" eyes={r.c} />
            </span>
            <span className="flex-1 text-[14px] font-bold">{r.name}</span>
            <span className="font-display text-[16px] font-black tabular-nums">{r.s}</span>
            {!r.me && <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-extrabold">Say hi</span>}
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[12px] text-white/60">
        Longest word today: <span className="font-black tracking-wide text-white">BRAVEST</span> · you missed <span className="font-black tracking-wide text-white">ABSENT</span>
      </p>

      <button type="button" className="gm-btn mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] py-3.5 font-display text-[18px] font-black text-white shadow-[0_6px_0_#128c4a]">
        <Share2 size={20} /> Share to WhatsApp
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white/65">
        <Clock size={15} /> Next board in 6h 12m
      </p>
    </div>
  );
}

/** 4. The picture that goes to WhatsApp status / groups */
function ShareCard() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0b141a] px-6 py-8">
      <div className="w-full max-w-[330px]">
        <p className="mb-2 text-center text-[12px] font-semibold text-white/45">What they post on WhatsApp</p>
        <div className="overflow-hidden rounded-[28px] p-5 text-white" style={{ background: BG, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8)" }}>
          <div className="flex items-center justify-between">
            <span className="font-display text-[20px] font-black">dashpad</span>
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-gold uppercase">Daily #42</span>
          </div>
          <div className="mt-4">
            {/* No letters: each tile glows by how many of your words used it, so it doesn't spoil the board */}
            <div className="grid grid-cols-4 gap-1.5 rounded-[20px] bg-black/20 p-2">
              {[3, 5, 6, 2, 4, 8, 9, 6, 7, 9, 5, 1, 2, 6, 7, 3].map((n, i) => (
                <span key={i} className="aspect-square rounded-[10px]" style={{ background: n > 7 ? "#ffd36b" : n > 5 ? "#f2b33d" : n > 3 ? "#1f9d6b" : n > 1 ? "#137a52" : "rgba(255,255,255,0.12)", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.2)" }} />
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="font-display text-[40px] leading-none font-black tabular-nums">3,400</p>
              <p className="mt-1 text-[13px] text-white/75">Top 5% · #2 in Lagos</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-b from-[#ffd36b] to-[#ff8a3d] px-3 py-1.5 text-[15px] font-black text-ink">
              <Flame size={18} /> 13
            </span>
          </div>
          <p className="mt-4 rounded-[14px] bg-black/25 px-3 py-2.5 text-center text-[13px] font-bold">Can you beat me? dashpad.site/daily</p>
        </div>
        <div className="mt-4 rounded-[14px] bg-[#005c4b] px-3 py-2 text-[14px] text-white">
          Dashpad Daily #42 🔥13
          <br />
          3,400 · 9 words · top 5%
          <br />
          Beat me 👉 dashpad.site/daily
        </div>
        <p className="mt-2 text-center text-[11px] text-white/40">No letters on the share, so it doesn&apos;t spoil today&apos;s board</p>
      </div>
    </div>
  );
}
