"use client";

// Design preview: the Daily Word Hunt on Home (not wired up yet).

function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="dc-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#ff6b3d" />
        </linearGradient>
      </defs>
      <path d="M12 1.5c1.5 4 7 6 7 12.5a7 7 0 0 1-14 0c0-3.2 1.6-5 3-6.4.3 2 1.2 3.3 2.5 3.9C9.8 7.5 11 4.2 12 1.5Z" fill="url(#dc-flame)" />
      <path d="M12 12.5c.9 1.8 3.2 2.7 3.2 5.2a3.2 3.2 0 0 1-6.4 0c0-1.6 1-2.6 1.9-3.3.2.8.6 1.3 1.2 1.5-.3-1.4 0-2.5.1-3.4Z" fill="#fff4c9" />
    </svg>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/** Home: today's Word Hunt, your streak and (once played) your place today */
export function DailyCard({ done }: { done?: boolean }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_14px_28px_-20px_rgba(20,10,40,0.35)] ring-1 ring-black/5">
      <div className="flex items-center gap-3.5">
        {/* Letter tiles */}
        <span aria-hidden className="grid h-[52px] w-[52px] shrink-0 grid-cols-2 gap-[3px] rounded-[14px] bg-[#1f9d6b] p-[5px] shadow-[0_4px_0_#137a52]">
          {"WORD".split("").map((l, i) => (
            <span key={i} className={"grid place-items-center rounded-[5px] text-[11px] font-extrabold " + (done && i < 3 ? "bg-gold text-ink" : "bg-[#fdfbf6] text-[#0b3a2a]")}>
              {l}
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px] font-bold text-ink">
            Daily Word Hunt <span className="rounded-full bg-[#e7f6ee] px-1.5 py-px text-[9.5px] font-extrabold tracking-[0.08em] text-[#137a52]">#42</span>
          </span>
          <span className="block truncate text-[12.5px] text-ink/60">{done ? "3,400 · #4 of 214 today" : "Same letters for everyone · 90s"}</span>
        </span>
      </div>

      {/* This week */}
      <div className="mt-3.5 flex items-center justify-between gap-1">
        {WEEK.map((d, i) => {
          const played = i < 4 || (done && i === 4);
          const today = i === 4;
          return (
            <span
              key={i}
              className={
                "grid h-7 flex-1 place-items-center rounded-full text-[11px] font-extrabold " +
                (played ? "bg-gradient-to-b from-[#ffb36b] to-[#ff7a3d] text-white" : today ? "bg-white text-ink ring-2 ring-gold" : "bg-ink/[0.05] text-ink/35")
              }
            >
              {played ? "✓" : d}
            </span>
          );
        })}
      </div>

      {done ? (
        <div className="mt-3.5 flex gap-2">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#25d366] py-2.5 text-[14px] font-extrabold text-white">Share</span>
          <span className="flex flex-1 items-center justify-center rounded-full bg-ink/[0.06] py-2.5 text-[14px] font-extrabold text-ink">See today&apos;s best</span>
        </div>
      ) : (
        <div className="mt-3.5 flex items-center gap-3">
          <span className="flex-1 text-[12.5px] leading-snug text-ink/60">
            <b className="text-[#c2410c]">Keep your streak</b> · 6h left
            <br />
            214 people played today
          </span>
          <span className="shrink-0 rounded-full bg-gold px-5 py-2.5 text-[14px] font-extrabold text-ink shadow-[0_4px_0_#b9831e]">Play</span>
        </div>
      )}
      {done && <p className="mt-2.5 text-center text-[11.5px] text-ink/50">Next board in 6h 12m</p>}
    </div>
  );
}

/** The little streak next to your Keys at the top of Home */
export function StreakChip({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-[#fff1e3] px-2.5 py-2 text-[16px] font-black text-[#c2410c]" aria-label={`${n} day streak`}>
      <Flame size={20} /> {n}
    </span>
  );
}
