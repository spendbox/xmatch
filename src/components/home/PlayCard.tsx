"use client";

import Link from "next/link";
import { tapFeedback } from "@/components/ui/Button";
import { usePrices } from "@/components/keys/usePrices";
import { KeyCoin } from "@/components/keys/KeyIcon";

/** Home: play a stranger. Dashpad pairs you by mood and picks the game. */
export function PlayCard() {
  const { play_cost: cost } = usePrices();
  return (
    <Link
      href="/play"
      onClick={() => tapFeedback()}
      data-tour="play"
      className="relative mt-3 flex items-center gap-3.5 overflow-hidden rounded-[24px] p-4 text-white shadow-[0_14px_28px_-18px_#0d4429] transition active:scale-[0.985]"
      style={{ background: "radial-gradient(120% 90% at 85% 10%, #2a8a5c, transparent 60%), #17663f" }}
    >
      <span aria-hidden className="relative h-[52px] w-[62px] shrink-0">
        {[
          { r: -22, x: -6, c: "#e5484d", t: "★" },
          { r: 0, x: 0, c: "#8f1d3a", t: "8" },
          { r: 22, x: 6, c: "#5b3fd9", t: "■" },
        ].map((k, i) => (
          <span
            key={i}
            className="absolute bottom-0 left-[18px] grid h-[44px] w-[30px] origin-bottom place-items-center rounded-[6px] bg-white text-[13px] font-extrabold shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
            style={{ transform: `rotate(${k.r}deg) translateX(${k.x}px)`, color: k.c }}
          >
            {k.t}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[17px] font-bold">
          Play a stranger <span className="rounded-full bg-white/18 px-1.5 py-px text-[9.5px] font-extrabold tracking-[0.08em]">NEW</span>
        </span>
        <span className="block truncate text-[12.5px] text-white/80">Dashpad picks the game · chat &amp; gift</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-3.5 py-2 text-[14px] font-extrabold text-ink">
        Play{cost > 0 && <span className="ml-0.5 inline-flex items-center gap-0.5 text-[12px] font-bold"><KeyCoin size={14} />{cost}</span>}
      </span>
    </Link>
  );
}
