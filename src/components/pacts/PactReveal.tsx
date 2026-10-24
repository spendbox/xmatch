"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { intentLabel, people, type Pact, type PactView, type RevealMatch } from "@/lib/pacts";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { PactLogo } from "./PactBits";
import { AFTER_JOIN, rememberToken } from "./pactTokens";

export type { RevealMatch };

/** Reveal night: a teaser to tap (an account is needed to reveal), then your match and how to say hi */
export function PactReveal({ pact, view, signedIn, total, token, preview }: { pact: Pact; view: PactView; signedIn: boolean; total: number; /** The private link's token, kept on this phone so the match follows them into their new account */ token?: string; /** Admin preview: the button just shows the next stage */ preview?: boolean }) {
  useEffect(() => {
    if (token) rememberToken(pact.slug, token);
  }, [token, pact.slug]);
  if (view.kind === "none") return <NoMatch pact={pact} lost={view.lost} signedIn={signedIn} total={total} />;
  if (view.kind === "teaser") return <Teaser pact={pact} view={view} signedIn={signedIn} total={total} preview={preview} />;
  return <Revealed pact={pact} match={view.match} signedIn={signedIn} total={total} />;
}

function NoMatch({ pact, lost, signedIn, total }: { pact: Pact; lost: boolean; signedIn: boolean; total: number }) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-8 text-center">
      <PactLogo pact={pact} size={72} />
      <h1 className="mt-5 font-display text-[30px] leading-tight font-bold">{lost ? "Your match moved on" : "No match this time"}</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/75">
        {lost
          ? "Your match joined Dashpad, but you hadn't within 48 hours, so they were matched with someone else. Join now and meet new people masked, every hour."
          : `Out of ${people(total)}, nobody fit what you were looking for. There are new people on Dashpad every hour.`}
      </p>
      <Link href={signedIn ? "/home" : "/signup"} className="mt-8 flex h-14 w-full max-w-sm items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: pact.accent }}>
        {signedIn ? "Go to Dashpad" : "Meet people on Dashpad"}
      </Link>
    </div>
  );
}

/** The gold star every pact match carries */
export function GoldStar({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={"grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffe08a] to-[#e3a21a] text-[#7a4a00] shadow-[0_0_0_2px_rgba(255,224,138,.35)] " + (className ?? "")} style={{ width: size, height: size }} aria-label="Link-Up match">
      <Star size={size * 0.6} fill="currentColor" strokeWidth={0} />
    </span>
  );
}

function Teaser({ pact, view, signedIn, total, preview }: { pact: Pact; view: Extract<PactView, { kind: "teaser" }>; signedIn: boolean; total: number; preview?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = pact.accent;
  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pacts/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: pact.slug }) }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError((await res?.json().catch(() => null))?.error ?? "Check your connection and try again.");
    }
    router.refresh();
  }
  return (
    <div className="relative flex min-h-full flex-col px-5 pt-6 pb-6">
      <div className="flex items-center justify-center gap-2">
        <PactLogo pact={pact} size={28} />
        <span className="text-[12.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: accent }}>Reveal night · {pact.name}</span>
      </div>
      <div className="mt-8 flex flex-col items-center text-center">
        <p className="text-[14px] text-white/75">{view.rematch ? "Your new match is ready" : `Out of ${people(total)}, one fits you best`}</p>
        <div className="relative mt-5 h-[176px] w-[176px]">
          <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: accent }} />
          <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-full" style={{ background: "linear-gradient(135deg, #e5484d, #f2b33d)" }}>
            <MaskIcon className="w-24 blur-[6px]" eyes="#1c1828" />
            <span className="absolute inset-0 grid place-items-center font-display text-[64px] font-bold text-white/90">?</span>
          </div>
          <GoldStar size={42} className="absolute -top-1 -right-1" />
        </div>
        <h1 className="mt-5 font-display text-[32px] leading-tight font-bold">You have a match</h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[14px] font-semibold">
          <span className="rounded-full px-3 py-1.5 text-[#1c1310]" style={{ background: accent }}>{view.score}% alike</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">Here for {intentLabel(view.intent).toLowerCase()}</span>
          {view.inCommon > 0 && <span className="rounded-full bg-white/10 px-3 py-1.5">{view.inCommon} {view.inCommon === 1 ? "answer" : "answers"} in common</span>}
        </div>
      </div>
      <div className="flex-1" />
      <div className="mt-8 grid gap-2">
        {preview ? (
          <Link href={`/link/${pact.slug}?preview=1&as=revealed`} className="flex h-14 items-center justify-center rounded-full text-[16.5px] font-extrabold text-[#1c1310]" style={{ background: accent }}>
            Join Dashpad to reveal
          </Link>
        ) : signedIn ? (
          <button onClick={reveal} disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-full text-[16.5px] font-extrabold text-[#1c1310] transition active:scale-[0.98] disabled:opacity-70" style={{ background: accent }}>
            <MaskIcon className="w-7" eyes={accent} /> {busy ? "Revealing…" : "Reveal my match"}
          </button>
        ) : (
          <Link
            href={`/signup?pact=${pact.slug}`}
            onClick={() => {
              try {
                localStorage.setItem(AFTER_JOIN, `/link/${pact.slug}`);
              } catch {
                /* private mode */
              }
            }}
            className="flex h-14 items-center justify-center rounded-full text-[16.5px] font-extrabold text-[#1c1310]"
            style={{ background: accent }}
          >
            Join Dashpad to reveal
          </Link>
        )}
        {error && <p className="text-center text-[13.5px] text-[#ffb4b4]">{error}</p>}
        <p className="text-center text-[12.5px] text-white/60">
          {signedIn ? "You'll both stay masked in chat until you both choose to unmask." : "It's free. Your match and your chat are waiting inside, and you both stay masked."}
        </p>
      </div>
    </div>
  );
}

function Revealed({ pact, match, signedIn, total }: { pact: Pact; match: RevealMatch; signedIn: boolean; total: number }) {
  const accent = pact.accent;
  const meta = [match.age ? String(match.age) : null, match.area, match.work, `Here for ${intentLabel(match.intent).toLowerCase()}`].filter(Boolean).join(" · ");
  const ring = Math.round((match.score / 100) * 490);
  return (
    <div className="relative flex min-h-full flex-col px-5 pt-6 pb-6">
      <div className="flex items-center justify-center gap-2">
        <PactLogo pact={pact} size={28} />
        <span className="text-[12.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: accent }}>Reveal night · {pact.name}</span>
      </div>
      <div className="mt-6 flex flex-col items-center text-center">
        <p className="text-[14px] text-white/75">{match.rematch ? "Your new match" : `Out of ${people(total)}, you two fit best`}</p>
        <div className="relative mt-4 h-[168px] w-[168px]">
          <svg viewBox="0 0 168 168" className="absolute inset-0" aria-hidden>
            <circle cx="84" cy="84" r="78" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
            <circle cx="84" cy="84" r="78" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${ring} 490`} transform="rotate(-90 84 84)" />
          </svg>
          <div className="absolute inset-4 grid place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #e5484d, #f2b33d)" }}>
            <MaskIcon className="w-24" eyes="#1c1828" />
          </div>
          <GoldStar size={36} className="absolute top-0 right-0" />
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
            {match.alias} hasn&apos;t joined Dashpad yet. We&apos;ve let them know, and your chat opens the moment they do. If they haven&apos;t joined in 48 hours, we&apos;ll find you a new match.
          </p>
        ) : null}
        <p className="text-center text-[12.5px] text-white/60">You&apos;re both masked. Unmask only when you both want to.</p>
      </div>
    </div>
  );
}
