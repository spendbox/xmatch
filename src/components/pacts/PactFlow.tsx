"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Bell, Briefcase, Check, Flame, Heart, Minus, Plus, Share2, Users } from "lucide-react";
import { INTENTS, WORK, pactPhase, type About, type Answer, type Answers, type Pact, type PactIntent, type PactQuestion } from "@/lib/pacts";
import { Turnstile } from "@/components/ui/Turnstile";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Countdown, OptionArt, PactLogo, pactDate } from "./PactBits";
import { PactReveal, type RevealMatch } from "./PactReveal";
import { rememberToken, savedPactTokens } from "./pactTokens";

type Step = "intro" | "q" | "about" | "finish" | "done";

/** Pacts taken on this phone: their private links, so they can be added to an account later */
const INTENT_ICONS: Record<PactIntent, React.ReactNode> = {
  business: <Briefcase size={18} />,
  friendship: <Users size={18} />,
  love: <Heart size={18} />,
  spicy: <Flame size={18} />,
};

export function PactFlow({
  pact,
  questions,
  count,
  signedIn,
  mine,
  result,
  demoStep,
}: {
  pact: Pact;
  questions: PactQuestion[];
  count: number;
  signedIn: boolean;
  /** Your answers, if you've already taken it with your account */
  mine: { about: About; answers: Answers } | null;
  /** Reveal night: your match (for people logged in) */
  result: { match: RevealMatch | null } | null;
  /** Previews only */
  demoStep?: { step: Step; qi?: number };
}) {
  const accent = pact.accent;
  const phase = pactPhase(pact);
  const draftKey = `dp_pact_draft_${pact.slug}`;
  const [step, setStep] = useState<Step>(demoStep?.step ?? "intro");
  const [qi, setQi] = useState(demoStep?.qi ?? 0);
  const [answers, setAnswers] = useState<Answers>(mine?.answers ?? {});
  const [about, setAbout] = useState<Partial<About>>(mine?.about ?? { intents: [], seeking: [], age: 25, ageMin: 21, ageMax: 35 });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<boolean>(!!mine);
  const [joined, setJoined] = useState(count);
  const form = useRef<HTMLFormElement>(null);

  // Pick up where you left off (on this phone)
  useEffect(() => {
    if (mine || demoStep) return;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (d?.answers) setAnswers(d.answers);
      if (d?.about) setAbout(d.about);
      if (savedPactTokens().some((t) => t.slug === pact.slug)) setTaken(true);
    } catch {
      /* nothing saved */
    }
  }, [draftKey, mine, demoStep, pact.slug]);
  useEffect(() => {
    if (demoStep) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, about }));
    } catch {
      /* private mode */
    }
  }, [answers, about, draftKey, demoStep]);

  const q = questions[qi];
  const total = questions.length;
  const answer = (id: string, v: Answer, advance = false) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (advance) setTimeout(next, 260);
  };
  function next() {
    setError(null);
    if (step === "intro") return setStep(questions.length ? "q" : "about");
    if (step === "q") {
      if (qi < total - 1) return setQi((i) => i + 1);
      return setStep("about");
    }
    if (step === "about") {
      const msg = aboutProblem(about, pact);
      if (msg) return setError(msg);
      return setStep("finish");
    }
  }
  function back() {
    setError(null);
    if (step === "q") return qi > 0 ? setQi((i) => i - 1) : setStep("intro");
    if (step === "about") return questions.length ? (setStep("q"), setQi(total - 1)) : setStep("intro");
    if (step === "finish") return setStep("about");
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (demoStep) return setStep("done");
    setBusy(true);
    setError(null);
    const human = form.current ? (new FormData(form.current).get("cf-turnstile-response") as string | null) : null;
    const token = savedPactTokens().find((t) => t.slug === pact.slug)?.token ?? null;
    const res = await fetch("/api/pacts/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: pact.slug, about, answers, email, token, human }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Check your connection and try again." };
    setBusy(false);
    if (!res?.ok || !data.token) return setError(data.error ?? "Something went wrong. Please try again.");
    rememberToken(pact.slug, data.token);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* private mode */
    }
    if (!taken) setJoined((n) => n + 1);
    setTaken(true);
    setStep("done");
  }

  // ---------------------------------------------------------------- reveal night
  if (phase === "revealed" && !demoStep) {
    return (
      <Shell pact={pact}>
        {result ? (
          <PactReveal pact={pact} match={result.match} signedIn={signedIn} total={joined} />
        ) : (
          <RevealLookup pact={pact} />
        )}
      </Shell>
    );
  }

  // ---------------------------------------------------------------- the pact page
  if (step === "intro") {
    const closed = phase === "closed";
    return (
      <Shell pact={pact}>
        <Header pact={pact} />
        <div className="relative -mt-11 flex flex-col items-center px-6 text-center">
          <span className="rounded-full border-4 border-[#160d2e] shadow-lift">
            <PactLogo pact={pact} />
          </span>
          <h1 className="mt-3.5 font-display text-[34px] leading-[1.05] font-bold tracking-tight [text-wrap:balance]">{pact.name}</h1>
          <p className="mt-2 max-w-[310px] text-[15px] leading-relaxed text-white/80">
            {pact.tagline || `Answer ${total} questions. On reveal night, everyone gets their one best match.`}
          </p>
        </div>
        <div className="mx-5 mt-6 rounded-[22px] border p-4" style={{ background: "#22163f", borderColor: `${accent}40` }}>
          <Countdown to={closed ? pact.reveal_at : pact.reveal_at} accent={accent} label="Reveal night in" />
          <div className="mt-3.5 flex items-center justify-center gap-2.5 border-t border-white/10 pt-3 text-[14px] font-semibold">
            <span className="flex">
              {["#5b3fd9,#1f9d6b", "#e5484d,#f2b33d", "#7cc8ff,#2b2066"].map((g, i) => (
                <span key={g} className="h-[26px] w-[26px] rounded-full border-2 border-[#22163f]" style={{ background: `linear-gradient(135deg, ${g})`, marginLeft: i ? -8 : 0 }} />
              ))}
            </span>
            <span>
              <b className="tabular-nums" style={{ color: accent }}>{joined.toLocaleString()}</b> {joined === 1 ? "person has" : "people have"} taken the Pact
            </span>
          </div>
        </div>
        <ol className="mx-5 mt-5 grid gap-2.5 text-[14px]">
          {[`Answer ${total} quick questions. About 2 minutes.`, "We find the one person most like you.", `Meet them masked on reveal night, ${pactDate(pact.reveal_at)}.`].map((t, i) => (
            <li key={t} className="flex items-center gap-3">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: `${accent}26`, color: accent }}>{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <div className="flex-1" />
        <div className="grid gap-2.5 px-5 pt-6 pb-[max(1.6rem,env(safe-area-inset-bottom))]">
          {closed ? (
            <p className="rounded-2xl bg-white/[0.07] px-4 py-3.5 text-center text-[14.5px] text-white/85">
              {taken ? "You're in. Answers are closed, and your match arrives on reveal night." : "Answers are closed for this pact. Reveal night is coming."}
            </p>
          ) : (
            <button onClick={next} className="h-14 rounded-full text-[16.5px] font-extrabold text-[#1c1310] transition active:scale-[0.98]" style={{ background: accent }}>
              {taken ? "Edit my answers" : "Take the Pact"}
            </button>
          )}
          <p className="text-center text-[12px] text-white/55">Free · your answers stay private · 18+ only</p>
        </div>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- done
  if (step === "done") {
    return (
      <Shell pact={pact}>
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <Seal accent={accent} />
          <h1 className="mt-3 font-display text-[30px] font-bold">You&apos;re in the Pact</h1>
          <p className="mt-1.5 text-[14.5px] text-white/75">
            <b className="tabular-nums" style={{ color: accent }}>{joined.toLocaleString()}</b> people so far. Your match arrives {pactDate(pact.reveal_at)}.
          </p>
        </div>
        {signedIn ? (
          <div className="mx-5 mt-6 grid gap-3 text-center">
            <p className="rounded-2xl bg-white/[0.07] px-4 py-3.5 text-[14.5px] leading-relaxed text-white/85">We&apos;ll send you a notification the moment your match drops. It also shows on your profile.</p>
            <button onClick={() => (setStep("q"), setQi(0))} className="h-12 rounded-full border border-white/20 text-[15px] font-bold">Change my answers</button>
          </div>
        ) : (
          <>
            <div className="mx-5 mt-6 flex items-baseline justify-between">
              <h2 className="font-display text-[21px] font-bold">Meet people like you, now</h2>
              <span className="text-[12px] text-white/55">Free on Dashpad</span>
            </div>
            <p className="mx-5 mt-1 text-[13.5px] text-white/70">Why wait for reveal night? Meet people masked, every hour, for whatever you&apos;re into.</p>
            <div className="mx-5 mt-3 grid grid-cols-2 gap-2.5">
              {[
                { icon: <Briefcase size={20} />, t: "Business", d: "Partners, clients and mentors who think like you.", g: "#1f4a7a" },
                { icon: <Users size={20} />, t: "Friendship", d: "Your kind of people, for brunch, games or the gym.", g: "#1f5a5a" },
                { icon: <Heart size={20} />, t: "Love", d: "Someone special, matched on who you are.", g: "#6e2a4a" },
                { icon: <Flame size={20} />, t: "Something spicy", d: "Keep it fun. Masked until you both say so.", g: "#7a3a12" },
              ].map((c) => (
                <div key={c.t} className="rounded-[18px] p-3.5" style={{ background: `linear-gradient(160deg, ${c.g}, #22163f)` }}>
                  <span style={{ color: accent }}>{c.icon}</span>
                  <p className="mt-2 text-[14px] leading-tight font-bold">{c.t}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-white/72">{c.d}</p>
                </div>
              ))}
            </div>
            <p className="mx-5 mt-3 flex items-center gap-2 text-[12.5px] text-white/70">
              <Check size={15} style={{ color: accent }} /> Your Pact answers carry over to your profile. Change them anytime.
            </p>
          </>
        )}
        <div className="flex-1" />
        <div className="grid gap-2 px-5 pt-5 pb-[max(1.4rem,env(safe-area-inset-bottom))]">
          {signedIn ? (
            <Link href="/home" className="flex h-14 items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: accent }}>Back to Dashpad</Link>
          ) : (
            <Link href={`/signup?pact=${pact.slug}`} className="flex h-14 items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: accent }}>Join Dashpad, it&apos;s free</Link>
          )}
          <ShareButton pact={pact} />
        </div>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- questions, about you, finish
  const progress = step === "q" ? (qi + 1) / (total + 2) : step === "about" ? (total + 1) / (total + 2) : 1;
  return (
    <Shell pact={pact}>
      <form ref={form} onSubmit={submit} className="flex min-h-full flex-1 flex-col px-[18px] pt-4 pb-[max(1.3rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5 px-1">
          <button type="button" onClick={back} aria-label="Back" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.08]">
            <ArrowLeft size={20} />
          </button>
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress * 100}%`, background: accent }} />
          </div>
          <span className="w-12 text-right text-[13px] font-bold text-white/70 tabular-nums">{step === "q" ? `${qi + 1}/${total}` : step === "about" ? "Almost" : "Last"}</span>
        </div>

        {step === "q" && q && <QuestionView key={q.id} q={q} value={answers[q.id]} accent={accent} onAnswer={answer} />}
        {step === "about" && <AboutView pact={pact} about={about} setAbout={setAbout} />}
        {step === "finish" && (
          <div className="mt-6 px-1">
            <p className="text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color: accent }}>Last step</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight font-bold">{signedIn ? "Ready to join?" : "Where should we send your match?"}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/72">
              {signedIn ? "Your match will show up on your profile and as a notification on reveal night." : "We'll email your private link on reveal night. Nobody else sees your email."}
            </p>
            {!signedIn && (
              <label className="mt-5 grid gap-2">
                <span className="text-[13px] font-bold">Your email</span>
                <input
                  id="pact-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="h-13 rounded-2xl border border-white/20 bg-white/[0.06] px-4 text-[16px] outline-none focus:border-white/50"
                  style={{ height: 52 }}
                />
              </label>
            )}
            {!signedIn && (
              <div className="mt-4">
                <Turnstile />
              </div>
            )}
            {pact.email_domain && !signedIn && (
              <p className="mt-4 rounded-2xl bg-white/[0.07] px-4 py-3 text-[13.5px] text-white/80">
                This pact is for {pact.email_domain.replace(/^@/, "")} emails. <Link href={`/login`} className="font-bold underline">Log in</Link> with yours to join.
              </p>
            )}
          </div>
        )}

        <div className="flex-1" />
        {error && <p className="mb-3 rounded-2xl bg-[#e5484d]/15 px-4 py-3 text-[14px] font-semibold text-[#ffb4b4]" role="alert">{error}</p>}
        <div className="flex items-center justify-between gap-3 px-1 pt-3">
          <span className="text-[13px] text-white/55">{step === "q" ? (q?.kind === "choose_many" ? `${(answers[q.id] as string[] | undefined)?.length ?? 0} of up to ${q.max_pick}` : "No wrong answers") : ""}</span>
          {step === "finish" ? (
            <button type="submit" disabled={busy} className="inline-flex h-[52px] items-center gap-2 rounded-full px-6 text-[16px] font-extrabold text-[#1c1310] disabled:opacity-60" style={{ background: accent }}>
              {busy ? "Saving…" : "Join the Pact"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={step === "q" && !answered(q, answers[q?.id ?? ""])}
              className="inline-flex h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-extrabold text-[#1c1310] transition disabled:opacity-35"
              style={{ background: accent }}
            >
              Next <ArrowRight size={17} />
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

function answered(q: PactQuestion | undefined, v: Answer | undefined) {
  if (!q || v === undefined) return false;
  if (q.kind === "choose_many") return Array.isArray(v) && v.length >= Math.max(1, q.min_pick);
  return true;
}

function aboutProblem(a: Partial<About>, pact: Pact) {
  if (!a.gender) return "Tell us if you're a woman or a man.";
  if (!a.intents?.length) return "Pick what you're here for.";
  if ((a.intents.includes("love") || a.intents.includes("spicy")) && !a.seeking?.length) return "Tell us who you'd like to meet.";
  if (pact.areas.length && !a.area) return "Pick your area.";
  if (a.intents.includes("business") && !a.work) return "Tell us what you do.";
  return null;
}

// ---------------------------------------------------------------- pieces

function Shell({ pact, children }: { pact: Pact; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0d0820] text-[#fbf4e6]">
      <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden bg-[#160d2e] lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:rounded-[32px] lg:shadow-2xl" style={{ ["--pact" as string]: pact.accent }}>
        {children}
      </div>
    </div>
  );
}

function Header({ pact }: { pact: Pact }) {
  return (
    <div className="relative h-[260px] shrink-0">
      {pact.header_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pact.header_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 70% 20%, ${pact.accent}aa 0%, #6a2a6e 40%, #160d2e 85%)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#160d2e]" />
      <span className="absolute top-[max(14px,env(safe-area-inset-top))] left-4 inline-flex h-[30px] items-center gap-1.5 rounded-full bg-[#160d2e]/60 px-3 text-[12px] font-bold backdrop-blur">
        <MaskIcon className="w-[18px]" eyes="#160d2e" /> Dashpad Pacts
      </span>
    </div>
  );
}

function Seal({ accent }: { accent: string }) {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden className="animate-pop">
      <path d="M46 4l7 6 9-2 4 8 9 3-1 9 6 7-6 7 1 9-9 3-4 8-9-2-7 6-7-6-9 2-4-8-9-3 1-9-6-7 6-7-1-9 9-3 4-8 9 2z" fill={accent} opacity="0.75" />
      <circle cx="46" cy="46" r="27" fill={accent} />
      <path d="M34 46l8 8 16-17" stroke="#3a2610" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareButton({ pact }: { pact: Pact }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}/pact/${pact.slug}`;
    const text = `I just took ${pact.name}. Take it too and see who you match with on reveal night.`;
    try {
      if (navigator.share) return await navigator.share({ title: pact.name, text, url });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing to do */
    }
  }
  return (
    <button onClick={share} className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 text-[14.5px] font-bold">
      <Share2 size={17} /> {copied ? "Link copied" : "Share the Pact"}
    </button>
  );
}

function QuestionView({ q, value, accent, onAnswer }: { q: PactQuestion; value: Answer | undefined; accent: string; onAnswer: (id: string, v: Answer, advance?: boolean) => void }) {
  const kicker = { this_or_that: "This or that", choose_one: "Pick one", choose_many: q.max_pick > 1 ? `Pick up to ${q.max_pick}` : "Pick one", scale: "Slide it" }[q.kind];
  return (
    <div className="mt-5 flex flex-1 flex-col animate-fade-in">
      <p className="px-1 text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color: accent }}>{kicker}</p>
      <h1 className="mt-1 px-1 font-display text-[29px] leading-[1.1] font-bold [text-wrap:balance]">{q.title}</h1>
      {q.subtitle && q.kind !== "choose_many" && <p className="mt-1 px-1 text-[14px] text-white/65">{q.subtitle}</p>}

      {q.kind === "this_or_that" && (
        <div className="relative mt-4 grid min-h-[420px] flex-1 grid-rows-2 gap-3">
          {q.options.slice(0, 2).map((o, i) => {
            const on = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onAnswer(q.id, o.id, true)}
                className="relative overflow-hidden rounded-[26px] text-left transition active:scale-[0.98]"
                style={on ? { boxShadow: `0 0 0 3px ${accent}, 0 14px 34px ${accent}40` } : undefined}
                aria-pressed={on}
              >
                <OptionArt option={o} index={i} />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-b from-transparent to-[#160d2e]/90 px-[18px] pt-10 pb-4">
                  <span className="font-display text-[23px] leading-tight font-bold">{o.label}</span>
                  {on && (
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[#1c1310]" style={{ background: accent }}>
                      <Check size={19} strokeWidth={3} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <span className="pointer-events-none absolute top-1/2 left-1/2 grid h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white/20 bg-[#160d2e] font-display text-[17px] font-bold" style={{ color: accent }}>or</span>
        </div>
      )}

      {q.kind === "choose_one" && (
        <div className={clsx("mt-4 grid gap-2.5", q.options.some((o) => o.image) ? "grid-cols-2" : "grid-cols-1")}>
          {q.options.map((o, i) => {
            const on = value === o.id;
            return o.image ? (
              <button key={o.id} type="button" onClick={() => onAnswer(q.id, o.id, true)} aria-pressed={on} className="relative aspect-[4/5] overflow-hidden rounded-[22px] text-left" style={on ? { boxShadow: `0 0 0 3px ${accent}` } : undefined}>
                <OptionArt option={o} index={i} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-[#160d2e]/90 px-3 pt-8 pb-3 text-[15px] leading-tight font-bold">{o.label}</span>
              </button>
            ) : (
              <button
                key={o.id}
                type="button"
                onClick={() => onAnswer(q.id, o.id, true)}
                aria-pressed={on}
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-[18px] border px-4 text-left text-[15.5px] font-bold transition active:scale-[0.99]"
                style={on ? { borderColor: accent, background: `${accent}1f` } : { borderColor: "rgba(255,255,255,.16)" }}
              >
                {o.label}
                {on && <Check size={19} style={{ color: accent }} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "choose_many" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {q.options.map((o, i) => {
            const list = (value as string[] | undefined) ?? [];
            const on = list.includes(o.id);
            const full = !on && list.length >= q.max_pick;
            return (
              <button
                key={o.id}
                type="button"
                disabled={full}
                aria-pressed={on}
                onClick={() => onAnswer(q.id, on ? list.filter((x) => x !== o.id) : [...list, o.id])}
                className="flex h-12 items-center gap-2 rounded-full border pr-4 pl-1.5 text-[14.5px] font-bold transition disabled:opacity-35"
                style={on ? { borderColor: accent, background: `${accent}24` } : { borderColor: "rgba(255,255,255,.16)", paddingLeft: o.image ? 6 : 16 }}
              >
                {o.image && (
                  <span className="relative h-9 w-9 overflow-hidden rounded-full">
                    <OptionArt option={o} index={i} />
                  </span>
                )}
                {on && !o.image && <Check size={16} style={{ color: accent }} strokeWidth={3} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "scale" && (
        <div className="mt-10 px-1">
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onAnswer(q.id, n)}
                  aria-label={`${n} of 5`}
                  aria-pressed={on}
                  className="grid aspect-square flex-1 place-items-center rounded-2xl border text-[18px] font-extrabold transition"
                  style={on ? { background: accent, borderColor: accent, color: "#1c1310" } : { borderColor: "rgba(255,255,255,.16)" }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between text-[13.5px] font-semibold text-white/70">
            <span>{q.options[0]?.label}</span>
            <span>{q.options[1]?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children, accent }: { on: boolean; onClick: () => void; children: React.ReactNode; accent: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="min-h-[50px] rounded-2xl border px-3 text-[14.5px] font-bold transition active:scale-[0.98]" style={on ? { borderColor: accent, borderWidth: 2, background: `${accent}1f` } : { borderColor: "rgba(255,255,255,.18)" }}>
      {children}
    </button>
  );
}

function Stepper({ value, onChange, min = 18, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex h-[50px] items-center justify-between rounded-2xl border border-white/18 px-1.5" style={{ borderColor: "rgba(255,255,255,.18)" }}>
      <button type="button" aria-label={`${label}: less`} onClick={() => onChange(Math.max(min, value - 1))} className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white/[0.08]"><Minus size={17} /></button>
      <span className="text-[17px] font-extrabold tabular-nums">{value}</span>
      <button type="button" aria-label={`${label}: more`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white/[0.08]"><Plus size={17} /></button>
    </div>
  );
}

function AboutView({ pact, about, setAbout }: { pact: Pact; about: Partial<About>; setAbout: (fn: (a: Partial<About>) => Partial<About>) => void }) {
  const accent = pact.accent;
  const set = (patch: Partial<About>) => setAbout((a) => ({ ...a, ...patch }));
  const intents = about.intents ?? [];
  const romantic = intents.includes("love") || intents.includes("spicy");
  const label = "text-[12px] font-extrabold tracking-[0.1em] text-white/60 uppercase";
  const offered = useMemo(() => INTENTS.filter((i) => pact.intents.includes(i.id)), [pact.intents]);
  return (
    <div className="mt-5 grid gap-5 px-1 animate-fade-in">
      <div>
        <h1 className="font-display text-[29px] leading-tight font-bold">Now, a little about you</h1>
        <p className="mt-1.5 text-[14.5px] text-white/72">So we only match you with people who fit. Nobody sees this.</p>
      </div>
      <div className="grid gap-2">
        <span className={label}>I&apos;m here for</span>
        <div className="grid grid-cols-2 gap-2">
          {offered.map((i) => {
            const on = intents.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ intents: on ? intents.filter((x) => x !== i.id) : [...intents, i.id] })}
                className="flex min-h-[64px] items-center gap-2.5 rounded-2xl border px-3 text-left transition active:scale-[0.98]"
                style={on ? { borderColor: accent, borderWidth: 2, background: `${accent}1f` } : { borderColor: "rgba(255,255,255,.18)" }}
              >
                <span style={{ color: accent }}>{INTENT_ICONS[i.id]}</span>
                <span>
                  <span className="block text-[14.5px] leading-tight font-bold">{i.label}</span>
                  <span className="block text-[12px] text-white/60">{i.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-[12px] text-white/50">Pick as many as you like.</span>
      </div>
      <div className="grid gap-2">
        <span className={label}>I&apos;m a</span>
        <div className="grid grid-cols-2 gap-2">
          <Chip accent={accent} on={about.gender === "woman"} onClick={() => set({ gender: "woman" })}>Woman</Chip>
          <Chip accent={accent} on={about.gender === "man"} onClick={() => set({ gender: "man" })}>Man</Chip>
        </div>
      </div>
      {romantic && (
        <div className="grid gap-2">
          <span className={label}>For love or spicy, I&apos;d like to meet</span>
          <div className="grid grid-cols-3 gap-2">
            <Chip accent={accent} on={about.seeking?.length === 1 && about.seeking[0] === "woman"} onClick={() => set({ seeking: ["woman"] })}>Women</Chip>
            <Chip accent={accent} on={about.seeking?.length === 1 && about.seeking[0] === "man"} onClick={() => set({ seeking: ["man"] })}>Men</Chip>
            <Chip accent={accent} on={about.seeking?.length === 2} onClick={() => set({ seeking: ["woman", "man"] })}>Both</Chip>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <span className={label}>My age</span>
          <Stepper label="My age" value={about.age ?? 25} onChange={(n) => set({ age: n })} />
        </div>
        <div className="grid gap-2">
          <span className={label}>Their age</span>
          <div className="grid grid-cols-2 gap-1.5">
            <Stepper label="Youngest" value={about.ageMin ?? 21} max={about.ageMax ?? 99} onChange={(n) => set({ ageMin: n })} />
            <Stepper label="Oldest" value={about.ageMax ?? 35} min={about.ageMin ?? 18} onChange={(n) => set({ ageMax: n })} />
          </div>
        </div>
      </div>
      {pact.areas.length > 0 && (
        <div className="grid gap-2">
          <span className={label}>My area</span>
          <div className={clsx("grid gap-2", pact.areas.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
            {pact.areas.map((a) => (
              <Chip key={a} accent={accent} on={about.area === a} onClick={() => set({ area: a })}>{a}</Chip>
            ))}
          </div>
        </div>
      )}
      {intents.includes("business") && (
        <div className="grid gap-2">
          <span className={label}>What I do</span>
          <div className="flex flex-wrap gap-2">
            {WORK.map((w) => (
              <button key={w} type="button" aria-pressed={about.work === w} onClick={() => set({ work: w })} className="h-11 rounded-full border px-4 text-[14px] font-bold" style={about.work === w ? { borderColor: accent, background: `${accent}24` } : { borderColor: "rgba(255,255,255,.16)" }}>
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Reveal night, not logged in: open the link from your email, or have it sent again */
function RevealLookup({ pact }: { pact: Pact }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => setMine(savedPactTokens().find((t) => t.slug === pact.slug)?.token ?? null), [pact.slug]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const human = form.current ? (new FormData(form.current).get("cf-turnstile-response") as string | null) : null;
    await fetch("/api/pacts/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: pact.slug, email, human }) }).catch(() => null);
    setSent(true);
  }
  return (
    <div className="flex flex-1 flex-col">
      <Header pact={pact} />
      <div className="relative -mt-11 flex flex-col items-center px-6 text-center">
        <span className="rounded-full border-4 border-[#160d2e]"><PactLogo pact={pact} /></span>
        <h1 className="mt-3.5 font-display text-[32px] leading-tight font-bold">Reveal night is here</h1>
        <p className="mt-2 max-w-xs text-[15px] text-white/78">Everyone in {pact.name} has their match. See yours.</p>
      </div>
      <div className="mx-5 mt-7 grid gap-3">
        {mine && (
          <Link href={`/pact/${pact.slug}/match?t=${mine}`} className="flex h-14 items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: pact.accent }}>See my match</Link>
        )}
        <Link href={`/login`} className="flex h-12 items-center justify-center rounded-full border border-white/20 text-[15px] font-bold">Log in to Dashpad</Link>
        {sent ? (
          <p className="flex items-center gap-2 rounded-2xl bg-white/[0.07] px-4 py-3 text-[14px] text-white/85"><Bell size={16} /> If you took the Pact with that email, your link is on its way.</p>
        ) : (
          <form ref={form} onSubmit={send} className="grid gap-2 rounded-[20px] bg-white/[0.06] p-4">
            <label htmlFor="resend-email" className="text-[13.5px] font-bold">Lost your link? We&apos;ll email it again.</label>
            <div className="flex gap-2">
              <input id="resend-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#160d2e] px-3.5 text-[15px]" />
              <button className="h-12 rounded-xl bg-white/[0.12] px-4 text-[14px] font-bold">Send</button>
            </div>
            <Turnstile />
          </form>
        )}
      </div>
    </div>
  );
}
