"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { MaskIcon } from "@/components/ui/MaskIcon";

export type Names = { me: string; them: string };

/** Re-render every `ms` so countdowns move */
export function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Seconds left until a server time */
export function secondsLeft(iso: string | null | undefined, now: () => number) {
  if (!iso) return 0;
  return Math.max(0, (new Date(iso).getTime() - now()) / 1000);
}

/** A round player token: the mask on a coloured disc */
export function Token({ color, size = 36, className }: { color: string; size?: number; className?: string }) {
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full", className)}
      style={{ width: size, height: size, background: color, color: "#1c1828", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.2)" }}
    >
      <MaskIcon className="w-[58%]" eyes={color} />
    </span>
  );
}

/** Circular countdown, gold ring */
export function Countdown({ seconds, total, size = 44 }: { seconds: number; total: number; size?: number }) {
  const pct = Math.max(0, Math.min(1, seconds / total));
  const low = seconds <= 5;
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full", low && seconds > 0 && "gm-pulse")}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${low ? "#ff6b6b" : "#f2b33d"} 0 ${pct * 100}%, rgba(255,255,255,0.12) ${pct * 100}% 100%)`,
      }}
      aria-label={`${Math.ceil(seconds)} seconds left`}
    >
      <span
        className="grid place-items-center rounded-full bg-[#140d33] text-[13px] font-extrabold tabular-nums"
        style={{ width: size - 8, height: size - 8 }}
      >
        {Math.ceil(seconds)}
      </span>
    </span>
  );
}

/** Falling confetti for wins */
export function Confetti({ count = 36 }: { count?: number }) {
  const bits = useMemo(() => {
    const colors = ["#f2b33d", "#ff7aa8", "#7dffb5", "#a78bfa", "#ffffff", "#7cc8ff"];
    return Array.from({ length: count }, (_, i) => ({
      left: `${(i * 37 + 7) % 100}%`,
      w: 6 + (i % 3) * 3,
      color: colors[i % colors.length],
      dx: `${((i * 53) % 120) - 60}px`,
      rot: `${360 + ((i * 97) % 540)}deg`,
      dur: `${2.2 + ((i * 13) % 12) / 10}s`,
      delay: `${((i * 7) % 10) / 20}s`,
    }));
  }, [count]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="gm-confetti rounded-[3px]"
          style={
            {
              left: b.left,
              width: b.w,
              height: 14,
              background: b.color,
              "--dx": b.dx,
              "--rot": b.rot,
              "--dur": b.dur,
              "--delay": b.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Big chunky button */
export function BigButton({
  children,
  onClick,
  disabled,
  variant = "gold",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "gold" | "ghost";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "gm-btn inline-flex h-14 items-center justify-center gap-2 rounded-[18px] px-5 text-[16px] font-extrabold disabled:opacity-50",
        variant === "gold" ? "gm-gold" : "gm-ghost font-bold",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const GOLD = "#f2b33d";
export const PURPLE = "#a78bfa";
