"use client";

import clsx from "clsx";
import { DiceFace } from "./GamePop";

/** The dice in its tray: tap to roll when it's your go */
export function DiceTray({ face, rolling, ready, onRoll, color, label }: { face: number; rolling: boolean; ready: boolean; onRoll: () => void; color: string; label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onRoll}
        disabled={!ready}
        aria-label={ready ? "Roll the dice" : label}
        className={clsx("relative grid h-[74px] w-[74px] place-items-center rounded-[22px] transition active:scale-95 lg:h-[96px] lg:w-[96px]", ready && "gm-pulse")}
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.16), rgba(0,0,0,0.25))",
          boxShadow: ready ? `0 0 0 3px ${color}, 0 0 28px 4px ${color}88` : "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        <span className={clsx("block h-[58px] w-[58px] lg:h-[76px] lg:w-[76px]", rolling && "gm-roll")} key={rolling ? "r" : face}>
          <DiceFace n={face} />
        </span>
      </button>
      <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase" style={{ color: ready ? color : "rgba(255,255,255,0.55)" }}>
        {ready ? "Tap to roll" : label}
      </span>
    </div>
  );
}

/** A big glossy token for pop-up art; `cross` marks one that's been captured */
export function TokenArt({ color, size = 80, cross }: { color: string; size?: number; cross?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-40 -40 80 80" aria-hidden>
      <defs>
        <radialGradient id={`ta-${color.slice(1)}`} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.8" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="30" rx="26" ry="7" fill="#000" opacity="0.35" />
      <circle r="30" cy="2" fill="#000" opacity="0.25" />
      <circle r="30" fill={`url(#ta-${color.slice(1)})`} stroke="#fff" strokeWidth="5" />
      <rect x="-17" y="-8" width="34" height="15" rx="7.5" fill="#fff" />
      <ellipse cx="-7.5" cy="-0.5" rx="4" ry="3.4" fill="#1a1035" />
      <ellipse cx="7.5" cy="-0.5" rx="4" ry="3.4" fill="#1a1035" />
      <ellipse cx="-11" cy="-18" rx="9" ry="4.5" fill="#fff" opacity="0.6" />
      {cross && (
        <g stroke="#ff4d5e" strokeWidth="8" strokeLinecap="round">
          <path d="M-26 -26 26 26M26 -26-26 26" stroke="#fff" strokeWidth="13" />
          <path d="M-26 -26 26 26M26 -26-26 26" />
        </g>
      )}
    </svg>
  );
}
