"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaskIcon } from "@/components/ui/MaskIcon";
import clsx from "clsx";
import type { Pact, PactOption } from "@/lib/pacts";

/** Colours for answer cards that have no picture */
const ART = [
  ["#6a1fa0", "#ff5aa5"],
  ["#1b3f8a", "#7cc8ff"],
  ["#0f5a46", "#2ee88b"],
  ["#7a3a0c", "#ffb347"],
  ["#5a1030", "#ff7a59"],
  ["#2b2066", "#c48bff"],
];

/** The picture side of an answer: the admin's image, or a soft glow in the pact's colours */
export function OptionArt({ option, index, className }: { option: PactOption; index: number; className?: string }) {
  const [a, b] = ART[index % ART.length];
  if (option.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={option.image} alt="" className={clsx("absolute inset-0 h-full w-full object-cover", className)} loading="lazy" />;
  }
  return (
    <span aria-hidden className={clsx("absolute inset-0", className)} style={{ background: `radial-gradient(120% 90% at 80% 10%, ${b} 0%, ${a} 55%, #120a26 100%)` }}>
      <span className="absolute -right-6 -bottom-8 h-32 w-32 rounded-full opacity-30" style={{ background: b }} />
      <span className="absolute top-5 left-6 h-10 w-10 rounded-full opacity-25" style={{ background: "#fff" }} />
    </span>
  );
}

/** The pact's round logo, or its initials */
export function PactLogo({ pact, size = 84 }: { pact: Pick<Pact, "logo_url" | "name" | "accent">; size?: number }) {
  const initials = pact.name.replace(/^the\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff3, ${pact.accent} 60%, #0006)` }}>
      {pact.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pact.logo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display font-bold text-[#1c1310]" style={{ fontSize: size * 0.36 }}>{initials}</span>
      )}
    </span>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Reveal night while everyone is being matched: checks again every 20 seconds until the matches are out */
export function PactMatching({ pact, count }: { pact: Pick<Pact, "name" | "accent" | "logo_url">; count: number }) {
  const router = useRouter();
  useEffect(() => {
    // Spread out, so thousands of phones don't all ask at the same second
    const t = setInterval(() => router.refresh(), 25_000 + Math.random() * 15_000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full opacity-25" style={{ background: pact.accent }} />
        <span className="relative grid h-24 w-24 place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #e5484d, #f2b33d)" }}>
          <MaskIcon className="w-14" eyes="#1c1828" />
        </span>
      </span>
      <p className="mt-7 text-[12.5px] font-extrabold tracking-[0.12em] uppercase" style={{ color: pact.accent }}>Reveal night · {pact.name}</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight font-bold">Matching everyone now</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/75">
        We&apos;re finding the best match for all {count.toLocaleString()} people. This takes a few minutes. Stay here, or we&apos;ll let you know.
      </p>
    </div>
  );
}

/** Days, hours, minutes and seconds until a time */
export function Countdown({ to, accent, label }: { to: string; accent: string; label: string }) {
  const now = useNow();
  const left = now === null ? null : Math.max(0, new Date(to).getTime() - now);
  const parts = left === null ? ["--", "--", "--", "--"] : [Math.floor(left / 86400_000), Math.floor(left / 3600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60].map((n) => String(n).padStart(2, "0"));
  return (
    <div>
      <p className="text-center text-[11.5px] font-extrabold tracking-[0.12em] uppercase" style={{ color: accent }}>{label}</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {["days", "hours", "mins", "secs"].map((u, i) => (
          <div key={u}>
            <div className="font-display text-[34px] leading-none font-bold tabular-nums" style={i === 3 ? { color: accent } : undefined}>{parts[i]}</div>
            <div className="mt-1 text-[11px] font-semibold text-white/60">{u}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Fri 30 Oct, 7:00 pm" in Lagos time, written the same on the server and the phone */
export function pactDate(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toLowerCase()}`;
}
