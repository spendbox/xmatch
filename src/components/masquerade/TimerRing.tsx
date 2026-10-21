import clsx from "clsx";

export function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, remaining / total));
  const low = remaining <= 30;
  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = String(Math.max(0, Math.floor(remaining) % 60)).padStart(2, "0");
  return (
    <div className="relative grid h-12 w-12 place-items-center" aria-label={`${mm} minutes ${ss} seconds left`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke={low ? "var(--color-chili)" : "var(--color-brand)"}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className={clsx("text-[12px] font-bold tabular-nums", low ? "text-chili" : "text-ink")}>
        {mm}:{ss}
      </span>
    </div>
  );
}
