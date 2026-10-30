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
      className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-[22px] border border-line bg-surface px-3 py-2.5 text-ink transition active:scale-[0.985]"
    >
      <span aria-hidden className="relative h-[44px] w-[44px] shrink-0 overflow-hidden rounded-[14px] bg-[#17663f]">
      <span className="absolute inset-0 origin-center scale-[0.62]">
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
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Play a stranger</span>
        <span className="block truncate text-[12.5px] text-muted">Dashpad picks the game · chat &amp; gift</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[13px] font-bold text-ink">
        Play{cost > 0 && <span className="ml-0.5 inline-flex items-center gap-0.5 text-[12px] font-bold"><KeyCoin size={14} />{cost}</span>}
      </span>
    </Link>
  );
}
