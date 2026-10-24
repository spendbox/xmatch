"use client";

import Link from "next/link";
import { pactPhase, type Pact } from "@/lib/pacts";
import { PactLogo, pactDate } from "./PactBits";

export type PactListItem = Pact & { count: number };

/** A pact shown as an event: header, logo, how many have answered, and when it reveals */
export function PactCard({ pact, compact }: { pact: PactListItem; compact?: boolean }) {
  const phase = pactPhase(pact);
  const when = phase === "open" ? `Answers close ${pactDate(pact.closes_at)}` : phase === "closed" ? `Reveal night ${pactDate(pact.reveal_at)}` : "Matches are out";
  return (
    <Link href={`/pact/${pact.slug}`} className="group relative block overflow-hidden rounded-[28px] bg-[#140d24] text-white shadow-card transition active:scale-[0.98]">
      <div className={compact ? "relative h-24" : "relative h-36"}>
        {pact.header_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pact.header_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        ) : (
          <span aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 100% at 85% 0%, ${pact.accent} 0%, #4a1f7a 45%, #140d24 100%)` }} />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#140d24] via-[#140d24]/30 to-transparent" />
        <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.08em] text-[#1c1310] uppercase" style={{ background: pact.accent }}>
          {phase === "open" ? "Pact · open" : phase === "closed" ? "Pact · reveal soon" : "Pact · revealed"}
        </span>
      </div>
      <div className="relative -mt-8 flex items-end gap-3 px-4 pb-4">
        <PactLogo pact={pact} size={compact ? 48 : 60} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[19px] leading-tight font-bold">{pact.name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-white/70">
            <b className="text-white tabular-nums">{pact.count.toLocaleString()}</b> answered · {when}
          </p>
        </div>
      </div>
      {!compact && pact.tagline && <p className="relative px-4 pb-4 -mt-1 text-[14px] leading-snug text-white/80">{pact.tagline}</p>}
    </Link>
  );
}
