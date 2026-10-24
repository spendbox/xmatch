import Link from "next/link";
import { intentLabel, type Pact, type PactIntent } from "@/lib/pacts";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { PactLogo } from "./PactBits";

export type RevealMatch = {
  alias: string;
  score: number;
  intent: PactIntent;
  age?: number;
  area: string | null;
  work: string | null;
  shared: { q: string; a: string }[];
  differ: { q: string; mine: string; theirs: string } | null;
  sessionId: string | null;
  theyHaveAccount: boolean;
};

/** Reveal night: your one match, what you share, and how to say hi */
export function PactReveal({ pact, match, signedIn, total }: { pact: Pact; match: RevealMatch | null; signedIn: boolean; total: number }) {
  const accent = pact.accent;
  if (!match) {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <PactLogo pact={pact} size={72} />
        <h1 className="mt-5 font-display text-[30px] leading-tight font-bold">No match this time</h1>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/75">
          Out of {total.toLocaleString()} people, nobody fit what you were looking for. There are new people on Dashpad every hour.
        </p>
        <Link href={signedIn ? "/home" : "/signup"} className="mt-8 flex h-14 w-full max-w-sm items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: accent }}>
          {signedIn ? "Go to Dashpad" : "Meet people on Dashpad"}
        </Link>
      </div>
    );
  }
  const meta = [match.age ? String(match.age) : null, match.area, match.work, `Here for ${intentLabel(match.intent).toLowerCase()}`].filter(Boolean).join(" · ");
  const ring = Math.round((match.score / 100) * 490);
  return (
    <div className="relative flex min-h-full flex-col px-5 pt-6 pb-6">
      <div className="flex items-center justify-center gap-2">
        <PactLogo pact={pact} size={28} />
        <span className="text-[12.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: accent }}>Reveal night · {pact.name}</span>
      </div>
      <div className="mt-6 flex flex-col items-center text-center">
        <p className="text-[14px] text-white/75">Out of {total.toLocaleString()} people, you two fit best</p>
        <div className="relative mt-4 h-[168px] w-[168px]">
          <svg viewBox="0 0 168 168" className="absolute inset-0" aria-hidden>
            <circle cx="84" cy="84" r="78" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
            <circle cx="84" cy="84" r="78" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${ring} 490`} transform="rotate(-90 84 84)" />
          </svg>
          <div className="absolute inset-4 grid place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #e5484d, #f2b33d)" }}>
            <MaskIcon className="w-24" eyes="#1c1828" />
          </div>
          <span className="absolute right-[-6px] bottom-1.5 inline-flex h-9 items-center rounded-full px-3 text-[15px] font-extrabold text-[#1c1310] tabular-nums" style={{ background: accent }}>
            {match.score}%
          </span>
        </div>
        <h1 className="mt-4 font-display text-[32px] leading-tight font-bold">{match.alias}</h1>
        <p className="mt-1 text-[14px] text-white/75">{meta}</p>
      </div>

      {(match.shared.length > 0 || match.differ) && (
        <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
          {match.shared.length > 0 && (
            <>
              <p className="text-[12px] font-extrabold tracking-[0.1em] text-white/60 uppercase">You both picked</p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {match.shared.map((s) => (
                  <li key={s.q} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: `${accent}24`, color: "#ffeec2" }} title={s.q}>
                    {s.a}
                  </li>
                ))}
              </ul>
            </>
          )}
          {match.differ && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
              <b className="text-white">Something to talk about:</b> {match.differ.q.replace(/…$/, "")}: you said &ldquo;{match.differ.mine}&rdquo;, {match.alias} said &ldquo;{match.differ.theirs}&rdquo;.
            </p>
          )}
        </div>
      )}

      <div className="flex-1" />
      <div className="mt-6 grid gap-2">
        {match.sessionId ? (
          <Link href={`/masquerade/${match.sessionId}`} className="flex h-14 items-center justify-center gap-2 rounded-full text-[16.5px] font-extrabold text-[#1c1310]" style={{ background: accent }}>
            <MaskIcon className="w-7" eyes={accent} /> Say hi, masked
          </Link>
        ) : signedIn ? (
          <p className="rounded-2xl bg-white/[0.06] px-4 py-3 text-center text-[14px] leading-relaxed text-white/80">
            {match.alias} hasn&apos;t joined Dashpad yet. We&apos;ve let them know, and your masked chat opens the moment they do.
          </p>
        ) : (
          <Link href={`/signup?pact=${pact.slug}`} className="flex h-14 items-center justify-center rounded-full text-[16.5px] font-extrabold text-[#1c1310]" style={{ background: accent }}>
            Join Dashpad to say hi
          </Link>
        )}
        <p className="text-center text-[12.5px] text-white/60">You&apos;re both masked. Unmask only when you both want to.</p>
      </div>
    </div>
  );
}
