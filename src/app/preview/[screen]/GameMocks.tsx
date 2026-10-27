"use client";

// Design previews for new games: X & O, Spellbound (word board), Last Card (colour cards), 8 Ball.
// Static sample screens in the game arena's look; not wired up.
import { ChevronLeft, Gift, RotateCcw, Shuffle, SmilePlus, VolumeX, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";

const BG = {
  xo: "radial-gradient(120% 60% at 50% 0%, #1d6b8a 0%, #0c2f45 60%, #061624 100%)",
  words: "radial-gradient(120% 60% at 50% 0%, #2f7a4a 0%, #123822 60%, #07180f 100%)",
  cards: "radial-gradient(120% 60% at 50% 0%, #b8263f 0%, #4f0d1c 60%, #1f050b 100%)",
  pool: "radial-gradient(120% 60% at 50% 0%, #1f5a8a 0%, #0c2440 60%, #050f1d 100%)",
};

function Shell({ bg, turn = true, them = "Golden Owl", meNote = "Your turn", themNote = "Waiting", meScore, themScore, children }: {
  bg: string; turn?: boolean; them?: string; meNote?: string; themNote?: string; meScore?: string; themScore?: string; children: React.ReactNode;
}) {
  return (
    <div className="gm-arena relative flex h-dvh flex-col overflow-hidden" style={{ background: bg }}>
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><ChevronLeft size={20} /></span>
        <span className="flex flex-1 justify-center">
          {turn ? (
            <span className="gm-pulse inline-block rounded-full bg-gradient-to-b from-[#ffd36b] to-gold px-4 py-1.5 font-display text-[15px] font-black tracking-[0.12em] text-ink uppercase shadow-[0_0_0_3px_rgba(242,179,61,0.3),0_6px_20px_-4px_rgba(242,179,61,0.8)]">Your turn</span>
          ) : (
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-bold tracking-wide text-white/80 uppercase">Their turn</span>
          )}
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><SmilePlus size={19} /></span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><VolumeX size={18} /></span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X size={19} /></span>
      </div>
      <div className="mt-3 flex items-center gap-2 px-3">
        <Player name="You" note={meNote} score={meScore} active={turn} color="#f2b33d" />
        <span className="text-[12px] font-bold text-white/50">VS</span>
        <Player name={them} note={themNote} score={themScore} active={!turn} color="#a78bfa" right />
      </div>
      {children}
      <span className="absolute top-[46%] right-0 flex flex-col items-center gap-0.5 rounded-l-2xl bg-gradient-to-b from-[#ffd36b] to-gold px-2.5 py-2 text-[10px] font-black text-ink"><Gift size={20} />GIFT</span>
    </div>
  );
}

function Player({ name, note, score, active, color, right }: { name: string; note: string; score?: string; active?: boolean; color: string; right?: boolean }) {
  return (
    <div className={"flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2.5 py-2 " + (active ? "bg-white/10 ring-2 ring-gold" : "bg-white/5") + (right ? " flex-row-reverse text-right" : "")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: color }}><MaskIcon className="w-6 text-ink" eyes={color} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{name}</span>
        <span className={"block truncate text-[12px] font-semibold " + (active ? "text-gold" : "text-white/55")}>{note}</span>
      </span>
      {score && <span className="font-display text-[22px] font-black">{score}</span>}
    </div>
  );
}

/** A big game pop-up in the middle of the screen */
function Pop({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "red" | "purple" }) {
  const t = tone === "red" ? "from-[#ff6b6b] to-[#e5484d] shadow-[0_8px_0_#a3262b]" : tone === "purple" ? "from-[#a78bfa] to-[#7a5cf0] shadow-[0_8px_0_#4c2fb0]" : "from-[#ffd36b] to-gold shadow-[0_8px_0_#b9831e]";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/35">
      <div className={`gm-stamp rounded-[26px] bg-gradient-to-b ${t} px-7 py-4 text-center text-ink`}>{children}</div>
    </div>
  );
}

function Confetti() {
  const colors = ["#f2b33d", "#ff7aa8", "#2fb3a0", "#7a5cf0", "#ffffff", "#5b6cff"];
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="absolute h-3 w-2 rounded-sm" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, background: colors[i % colors.length], transform: `rotate(${i * 41}deg)` }} />
      ))}
    </div>
  );
}

/* ——————————————— X & O ——————————————— */
type Cell = { v: "x" | "o"; age?: number; old?: boolean; win?: boolean } | null;
const XMark = ({ old, win }: { old?: boolean; win?: boolean }) => (
  <svg viewBox="0 0 60 60" className={"h-[68%] w-[68%] " + (old ? "animate-pulse opacity-40" : "") + (win ? " drop-shadow-[0_0_14px_#ffd36b]" : "")}>
    <path d="M14 14 L46 46 M46 14 L14 46" stroke="#b9831e" strokeWidth="13" strokeLinecap="round" transform="translate(0 3)" />
    <path d="M14 14 L46 46 M46 14 L14 46" stroke="url(#gx)" strokeWidth="12" strokeLinecap="round" />
    <defs><linearGradient id="gx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#f2b33d" /></linearGradient></defs>
  </svg>
);
const OMark = ({ old, win }: { old?: boolean; win?: boolean }) => (
  <svg viewBox="0 0 60 60" className={"h-[70%] w-[70%] " + (old ? "animate-pulse opacity-40" : "") + (win ? " drop-shadow-[0_0_14px_#c4b5fd]" : "")}>
    <circle cx="30" cy="33" r="18" fill="none" stroke="#4c2fb0" strokeWidth="11" />
    <circle cx="30" cy="30" r="18" fill="none" stroke="#a78bfa" strokeWidth="11" />
  </svg>
);

export function XOMock({ step }: { step: 1 | 2 | 3 }) {
  const board: Cell[] = step === 1
    ? [{ v: "x", old: true }, null, { v: "o" }, null, { v: "x" }, { v: "o", old: true }, { v: "o" }, null, { v: "x" }]
    : [{ v: "x", win: true }, null, { v: "o" }, null, { v: "x", win: true }, { v: "o" }, { v: "o" }, null, { v: "x", win: true }];
  return (
    <Shell bg={BG.xo} meNote={step === 1 ? "Your turn · 8s" : "Round 3 won!"} themNote="Waiting" meScore="2" themScore="1">
      {/* Rounds: best of 5 */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {["x", "o", "x", null, null].map((w, i) => (
          <span key={i} className={"grid h-7 w-7 place-items-center rounded-full text-[12px] font-black " + (w === "x" ? "bg-gold text-ink" : w === "o" ? "bg-[#a78bfa] text-ink" : "bg-white/10 text-white/50")}>{w ? w.toUpperCase() : i + 1}</span>
        ))}
        <span className="ml-1 text-[12px] font-bold text-white/60">BEST OF 5</span>
      </div>
      <div className="relative mx-auto mt-6 w-[86%] max-w-[360px]">
        <div className="grid aspect-square grid-cols-3 gap-2.5 rounded-[30px] bg-[#0a2233]/70 p-2.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08),0_20px_50px_-20px_rgba(0,0,0,0.8)]">
          {board.map((c, i) => (
            <div key={i} className={"grid place-items-center rounded-[20px] " + (c?.win ? "bg-white/25" : "bg-white/[0.07]") + (step === 1 && i === 7 ? " ring-2 ring-gold/70 ring-dashed" : "")}>
              {c?.v === "x" && <XMark old={c.old} win={c.win} />}
              {c?.v === "o" && <OMark old={c.old} win={c.win} />}
            </div>
          ))}
        </div>
        {step !== 1 && (
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full"><path d="M12 12 L88 88" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" className="drop-shadow-[0_0_8px_#ffd36b]" /></svg>
        )}
      </div>
      {step === 1 && (
        <div className="mx-auto mt-5 flex max-w-[330px] items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-2.5 text-[13px] leading-snug">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/20"><XMark old /></span>
          <span><b>Only 3 marks each.</b> Your faded X disappears when you place your next one. Plan ahead!</span>
        </div>
      )}
      {step === 2 && (
        <>
          <Confetti />
          <Pop>
            <p className="font-display text-[34px] leading-none font-black">3 IN A ROW!</p>
            <p className="mt-1 text-[14px] font-bold">You take round 3 · 2–1</p>
          </Pop>
        </>
      )}
      {step === 3 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-6">
          <div className="gm-burst w-full max-w-[330px] rounded-[30px] bg-gradient-to-b from-[#123f5a] to-[#0a2233] p-6 text-center ring-1 ring-white/15">
            <p className="text-[12px] font-bold tracking-[0.2em] text-gold">HOW TO PLAY</p>
            <p className="mt-1 font-display text-[34px] font-black">X &amp; O</p>
            <ul className="mt-4 space-y-2.5 text-left text-[14px] leading-snug">
              <li>❌⭕ Get 3 in a row: across, down or corner to corner.</li>
              <li>✨ <b>Only 3 marks each.</b> Place a 4th and your oldest one vanishes. No draws, ever.</li>
              <li>⏱️ 10 seconds a move, or it plays for you.</li>
              <li>🏆 Best of 5. Loser of a round goes first next.</li>
            </ul>
            <span className="gm-btn gm-gold mt-5 flex h-12 items-center justify-center rounded-full text-[16px] font-black">Let&apos;s play</span>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ——————————————— Spellbound (word board) ——————————————— */
const N = 11;
// Bonus squares: tw triple word, dw double word, tl triple letter, dl double letter
function bonus(r: number, c: number) {
  const k = `${Math.min(r, N - 1 - r)},${Math.min(c, N - 1 - c)}`;
  if (["0,0", "0,5", "5,0"].includes(k)) return "tw";
  if (["1,1", "2,2", "3,3", "5,5"].includes(k)) return "dw";
  if (["1,4", "4,1", "4,4"].includes(k)) return "tl";
  if (["0,3", "3,0", "2,5", "5,2", "3,5", "5,3"].includes(k)) return "dl";
  return null;
}
const PT: Record<string, number> = { A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, R: 1, S: 1, T: 1, D: 2, G: 2, B: 3, C: 3, M: 3, P: 3, F: 4, H: 4, V: 4, W: 4, Y: 4, K: 5, J: 8, X: 8, Q: 10, Z: 10 };
const placed: Record<string, { l: string; mine?: boolean; fresh?: boolean }> = {};
const put = (r: number, c: number, word: string, down: boolean, mine?: boolean, fresh?: boolean) =>
  [...word].forEach((l, i) => (placed[`${down ? r + i : r},${down ? c : c + i}`] = { l, mine, fresh }));
put(5, 2, "JOLLOF", false, false);
put(4, 6, "LOVE", true, true);
put(5, 3, "OWAMBE", true, false);
put(9, 1, "VI", false, false, true);
put(9, 4, "E", false, false, true);
// The word being played: V I (B already there) E, and what it scores
const FRESH: [number, number][] = [[9, 1], [9, 2], [9, 4]];
const vibeScore = (() => {
  let sum = 0;
  let mult = 1;
  for (const [rr, cc, l] of [[9, 1, "V"], [9, 2, "I"], [9, 3, "B"], [9, 4, "E"]] as [number, number, string][]) {
    const fresh = FRESH.some(([a, b]) => a === rr && b === cc);
    const b = fresh ? bonus(rr, cc) : null;
    sum += PT[l] * (b === "dl" ? 2 : b === "tl" ? 3 : 1);
    if (b === "dw") mult *= 2;
    if (b === "tw") mult *= 3;
  }
  return sum * mult;
})();

function Tile({ l, size = 30, fresh, rack }: { l: string; size?: number; fresh?: boolean; rack?: boolean }) {
  return (
    <span
      className={"relative grid place-items-center rounded-[22%] font-display font-black text-ink " + (fresh ? "bg-gradient-to-b from-[#ffe7a6] to-[#ffc94a] shadow-[0_3px_0_#c98f18]" : "bg-gradient-to-b from-[#fff6e3] to-[#f3dfb6] shadow-[0_3px_0_#c9ad78]")}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {l}
      <span className="absolute right-[8%] bottom-[2%] font-sans font-bold" style={{ fontSize: size * (rack ? 0.24 : 0.26) }}>{PT[l]}</span>
    </span>
  );
}

export function WordsMock({ step }: { step: 1 | 2 }) {
  const cell = 31;
  return (
    <Shell bg={BG.words} meNote="Your turn" themNote="72 pts" meScore="86" themScore="72">
      <div className="relative mx-auto mt-4 rounded-[18px] bg-[#0d2c1a] p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${N}, ${cell}px)` }}>
          {Array.from({ length: N * N }, (_, n) => {
            const r = Math.floor(n / N);
            const c = n % N;
            const t = placed[`${r},${c}`];
            const b = bonus(r, c);
            if (t) return <Tile key={n} l={t.l} size={cell} fresh={t.fresh} />;
            const bg = b === "tw" ? "bg-[#e5484d]" : b === "dw" ? "bg-[#ff7aa8]" : b === "tl" ? "bg-[#4d7cfe]" : b === "dl" ? "bg-[#7cc8ff]" : "bg-[#1d5435]";
            return (
              <span key={n} className={`grid place-items-center rounded-[6px] text-[8px] font-black text-white/90 ${bg}`} style={{ width: cell, height: cell }}>
                {r === 5 && c === 5 ? "★" : b ? b.toUpperCase() : ""}
              </span>
            );
          })}
        </div>
        {/* Live score as you place */}
        <span className="gm-burst absolute rounded-full bg-gold px-2.5 py-1 text-[13px] font-black text-ink shadow-[0_4px_0_#b9831e]" style={{ left: 3 + 5 * (cell + 2) + 4, top: 3 + 9 * (cell + 2) - 4 }}>+{vibeScore}</span>
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold text-white/80">VIBE · ✓ a word · <span className="text-gold">+{vibeScore}</span></p>
      {/* Your tiles */}
      <div className="mt-auto px-3 pb-6">
        <div className="mx-auto flex w-fit gap-1.5 rounded-[20px] bg-black/30 p-2.5">
          {"RNSDTEA".split("").map((l, i) => (i < 3 ? <Tile key={i} l={l} size={42} rack /> : <span key={i} className={i === 3 ? "rounded-[10px]" : ""}><Tile l={l} size={42} rack /></span>))}
        </div>
        <div className="mt-3 grid grid-cols-[48px_48px_1fr] gap-2">
          <span className="gm-btn gm-ghost grid h-12 place-items-center rounded-full"><Shuffle size={19} /></span>
          <span className="gm-btn gm-ghost grid h-12 place-items-center rounded-full"><RotateCcw size={19} /></span>
          <span className="gm-btn gm-gold grid h-12 place-items-center rounded-full text-[16px] font-black">Play VIBE · +{vibeScore}</span>
        </div>
        <p className="mt-2 text-center text-[12px] text-white/55">Bag: 38 tiles · Naija words count: jollof, wahala, abeg ✓</p>
      </div>
      {step === 2 && (
        <>
          <Confetti />
          <Pop>
            <p className="font-display text-[40px] leading-none font-black">BINGO!</p>
            <p className="mt-1 text-[15px] font-bold">All 7 tiles · +50 bonus</p>
          </Pop>
        </>
      )}
    </Shell>
  );
}

/* ——————————————— Last Card (colour cards) ——————————————— */
const COL = { r: "#e5484d", y: "#ffb02e", g: "#1f9d6b", b: "#3b6cf0" } as const;
function Card({ c, v, size = 1, tilt = 0, back }: { c?: keyof typeof COL | "w"; v?: string; size?: number; tilt?: number; back?: boolean }) {
  const w = 74 * size;
  const h = 108 * size;
  if (back)
    return (
      <span className="relative grid shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#2a1040] to-[#120620] ring-[3px] ring-white" style={{ width: w, height: h, transform: `rotate(${tilt}deg)` }}>
        <span className="rotate-[-18deg] rounded-full bg-[#e5484d] px-2 py-0.5 font-display font-black text-white" style={{ fontSize: 13 * size }}>LAST</span>
      </span>
    );
  const wild = c === "w";
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[14px] ring-[3px] ring-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.7)]"
      style={{ width: w, height: h, transform: `rotate(${tilt}deg)`, background: wild ? "conic-gradient(#e5484d 0 25%, #ffb02e 0 50%, #1f9d6b 0 75%, #3b6cf0 0)" : COL[c!] }}
    >
      <span className="absolute inset-[12%] rounded-[50%] bg-white/90" style={{ transform: "rotate(-30deg)" }} />
      <span className="relative font-display font-black" style={{ fontSize: 34 * size * (v && v.length > 2 ? 0.7 : 1), color: wild ? "#1c1828" : COL[c!] }}>{v}</span>
      <span className="absolute top-1 left-1.5 font-display font-black text-white" style={{ fontSize: 13 * size }}>{v && v.length > 2 ? "" : v}</span>
    </span>
  );
}

export function CardsMock({ step }: { step: 1 | 2 }) {
  return (
    <Shell bg={BG.cards} meNote="Your turn · 2 cards" themNote="4 cards">
      <div className="mt-4 flex justify-center -space-x-8">
        {[-12, -4, 4, 12].map((t) => <Card key={t} back size={0.62} tilt={t} />)}
      </div>
      <div className="relative mx-auto mt-6 flex items-center justify-center gap-6">
        <div className="relative">
          <Card back size={0.95} />
          <span className="absolute -top-2 -right-2 rounded-full bg-gold px-2 text-[12px] font-black text-ink">41</span>
          <p className="mt-2 text-center text-[12px] font-semibold text-white/70">Draw</p>
        </div>
        <div className="relative">
          <span className="absolute top-1 left-2"><Card c="y" v="7" size={0.95} tilt={-10} /></span>
          <Card c="w" v="+4" size={0.95} tilt={6} />
          <p className="mt-2 text-center text-[12px] font-semibold text-white/70">Now: <span className="text-[#ffb02e]">yellow</span></p>
        </div>
      </div>
      {/* Direction and the colour in play */}
      <p className="mt-4 text-center text-[13px] font-semibold text-white/75">Golden Owl played <b>+4</b> and picked <span className="text-[#ffb02e]">yellow</span></p>
      <div className="mt-auto pb-6">
        <div className="relative flex justify-center">
          <span className="gm-pulse absolute -top-14 rounded-full bg-gradient-to-b from-[#ff6b6b] to-[#e5484d] px-5 py-2 font-display text-[17px] font-black tracking-wide shadow-[0_5px_0_#a3262b]">LAST CARD!</span>
        </div>
        <p className="mb-2 text-center text-[11px] font-bold tracking-[0.2em] text-gold">YOUR CARDS · 2</p>
        <div className="flex justify-center -space-x-3">
          <span className="-translate-y-3"><Card c="y" v="⊘" size={1.05} tilt={-6} /></span>
          <Card c="b" v="3" size={1.05} tilt={6} />
        </div>
      </div>
      {step === 1 && (
        <Pop tone="red">
          <p className="font-display text-[48px] leading-none font-black text-white">+4!</p>
          <p className="mt-1 text-[15px] font-bold text-white">You draw 4 · colour is now yellow</p>
        </Pop>
      )}
      {step === 2 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/45">
          <div className="gm-burst rounded-[30px] bg-[#2a0a14] p-5 text-center ring-1 ring-white/15">
            <p className="font-display text-[22px] font-black">Pick a colour</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(Object.keys(COL) as (keyof typeof COL)[]).map((k) => (
                <span key={k} className="gm-btn h-20 w-28 rounded-[20px] text-[15px] font-black capitalize" style={{ background: COL[k], boxShadow: "0 6px 0 rgba(0,0,0,0.3)" }}>
                  <span className="grid h-full place-items-center">{{ r: "Red", y: "Yellow", g: "Green", b: "Blue" }[k]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ——————————————— 8 Ball ——————————————— */
const BALL: Record<number, string> = { 1: "#ffd23f", 2: "#3b6cf0", 3: "#e5484d", 4: "#7a3fd0", 5: "#ff8a1f", 6: "#1f9d6b", 7: "#8a2a1f", 8: "#141414", 9: "#ffd23f", 10: "#3b6cf0", 11: "#e5484d", 12: "#7a3fd0", 13: "#ff8a1f", 14: "#1f9d6b", 15: "#8a2a1f" };
function Ball({ n, x, y, r = 11 }: { n: number; x: number; y: number; r?: number }) {
  const stripe = n > 8;
  return (
    <g>
      <circle cx={x + 1.5} cy={y + 2} r={r} fill="rgba(0,0,0,0.35)" />
      <circle cx={x} cy={y} r={r} fill={stripe ? "#fdfaf2" : BALL[n]} />
      {stripe && <path d={`M${x - r} ${y - r * 0.45} h${r * 2} v${r * 0.9} h${-r * 2} z`} fill={BALL[n]} clipPath={`circle(${r}px at ${x}px ${y}px)`} />}
      {stripe && <rect x={x - r} y={y - r * 0.45} width={r * 2} height={r * 0.9} fill={BALL[n]} style={{ clipPath: `circle(${r}px at ${r}px ${r * 0.45}px)` }} />}
      <circle cx={x} cy={y} r={r * 0.45} fill="#fff" />
      <text x={x} y={y + r * 0.2} textAnchor="middle" fontSize={r * 0.62} fontWeight="900" fill="#141414">{n}</text>
      <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.22} fill="rgba(255,255,255,0.55)" />
    </g>
  );
}

export function PoolMock({ step }: { step: 1 | 2 }) {
  const W = 300;
  const H = 500;
  const rack: [number, number, number][] = [];
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let k = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) rack.push([order[k++], 150 + (i - row / 2) * 23, 150 - row * 20]);
  const potted = { me: [1, 3], them: [9] };
  return (
    <Shell bg={BG.pool} meNote={step === 1 ? "Solids · your shot" : "Ball in hand"} themNote="Stripes">
      <div className="mt-2 flex justify-between px-4">
        <span className="flex gap-1">{[1, 2, 3, 4, 5, 6, 7].map((n) => <svg key={n} width="18" height="18" viewBox="0 0 26 26" className={potted.me.includes(n) ? "" : "opacity-25"}><Ball n={n} x={13} y={13} r={11} /></svg>)}</span>
        <span className="flex gap-1">{[9, 10, 11, 12, 13, 14, 15].map((n) => <svg key={n} width="18" height="18" viewBox="0 0 26 26" className={potted.them.includes(n) ? "" : "opacity-25"}><Ball n={n} x={13} y={13} r={11} /></svg>)}</span>
      </div>
      <div className="relative mx-auto mt-3 flex items-start gap-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
          <rect x="0" y="0" width={W} height={H} rx="28" fill="#5a3418" />
          <rect x="6" y="6" width={W - 12} height={H - 12} rx="24" fill="#7a4a22" />
          <rect x="20" y="20" width={W - 40} height={H - 40} rx="10" fill="#1a7a4c" />
          <rect x="20" y="20" width={W - 40} height={H - 40} rx="10" fill="url(#felt)" />
          <defs>
            <radialGradient id="felt" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#24a165" stopOpacity="0.9" /><stop offset="1" stopColor="#0e4f30" stopOpacity="0.95" /></radialGradient>
          </defs>
          {[[22, 22], [W - 22, 22], [18, H / 2], [W - 18, H / 2], [22, H - 22], [W - 22, H - 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="15" fill="#0b0b0b" />)}
          <line x1="20" y1={H * 0.75} x2={W - 20} y2={H * 0.75} stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          {rack.filter(([n]) => !potted.me.includes(n) && !potted.them.includes(n)).map(([n, x, y]) => <Ball key={n} n={n} x={x} y={y} />)}
          {/* Aim: the line, where the ball will go, and the cue */}
          {step === 1 && (
            <>
              <line x1="150" y1="380" x2="160" y2="172" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeDasharray="6 6" />
              <circle cx="160" cy="172" r="11" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              <line x1="164" y1="164" x2="182" y2="128" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeDasharray="4 5" />
              <line x1="149" y1="420" x2="142" y2="590" stroke="#e8c48a" strokeWidth="9" strokeLinecap="round" />
              <line x1="149" y1="420" x2="148.4" y2="432" stroke="#3b6cf0" strokeWidth="9" strokeLinecap="round" />
            </>
          )}
          <circle cx="151.5" cy="382" r="11" fill="rgba(0,0,0,0.35)" />
          <circle cx="150" cy="380" r="11" fill="#fdfaf2" />
          {step === 2 && <circle cx="150" cy="380" r="20" fill="none" stroke="#ffd36b" strokeWidth="3" strokeDasharray="5 5" className="animate-spin" style={{ transformOrigin: "150px 380px", animationDuration: "6s" }} />}
        </svg>
        {/* Power: pull down to shoot */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="text-[10px] font-black tracking-wider text-white/60">POWER</span>
          <div className="relative h-48 w-5 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-x-0 bottom-0 h-[62%] rounded-full bg-gradient-to-t from-[#ffd36b] via-[#ff8a1f] to-[#e5484d]" />
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[10px] font-black">SPIN</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold text-white/75">{step === 1 ? "Drag to aim · pull the power bar and let go" : "Drag the white ball anywhere, then shoot"}</p>
      {step === 2 && (
        <Pop tone="red">
          <p className="font-display text-[36px] leading-none font-black text-white">FOUL!</p>
          <p className="mt-1 text-[14px] font-bold text-white">Golden Owl potted the white · ball in hand</p>
        </Pop>
      )}
    </Shell>
  );
}
