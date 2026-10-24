"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Bell, Briefcase, Check, Flame, Heart, Minus, Plus, Share2, Users } from "lucide-react";
import { INTENTS, WORK, pactPhase, people, type PactView, type About, type Answer, type Answers, type Pact, type PactIntent, type PactQuestion } from "@/lib/pacts";
import { Turnstile } from "@/components/ui/Turnstile";
import { Countdown, OptionArt, PactLogo, PactMatching } from "./PactBits";
import { pactDate } from "@/lib/pacts";
import { PactReveal } from "./PactReveal";
import { AFTER_JOIN, savedPactTokens } from "./pactTokens";

type Step = "intro" | "q" | "about" | "finish" | "done" | "edit";

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
  preview,
  edit,
}: {
  pact: Pact;
  questions: PactQuestion[];
  count: number;
  signedIn: boolean;
  /** Your answers, if you've already taken it with your account */
  mine: { about: About; answers: Answers } | null;
  /** Reveal night: your teaser or match (for people logged in) */
  result: PactView | null;
  /** Previews only */
  demoStep?: { step: Step; qi?: number };
  /** Admin preview: everything works, but nothing is saved */
  preview?: boolean;
  /** Opened from your "You're in" card: go straight to your answers to change them */
  edit?: boolean;
}) {
  const sample = !!demoStep || !!preview;
  const accent = pact.accent;
  const phase = pactPhase(pact);
  const draftKey = `dp_pact_draft_${pact.slug}`;
  const router = useRouter();
  const [step, setStep] = useState<Step>(demoStep?.step ?? (edit && pactPhase(pact) === "open" ? "edit" : "intro"));
  const [qi, setQi] = useState(demoStep?.qi ?? 0);
  const [answers, setAnswers] = useState<Answers>(mine?.answers ?? {});
  const [about, setAbout] = useState<Partial<About>>(mine?.about ? { ...mine.about, intents: (mine.about.intents ?? []).slice(0, 1) } : { intents: [], seeking: [], age: 25, ageMin: 21, ageMax: 35 });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<boolean>(!!mine);
  const [joined, setJoined] = useState(count);
  // Changing saved answers: one screen with everything, tap a question to change it
  const [editing, setEditing] = useState(!!edit);
  const [savedEdit, setSavedEdit] = useState(false);
  // School and company pacts: the inbox we sent a confirmation link to
  const [confirmTo, setConfirmTo] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Back from creating an account (or logging in) to join: save the answers kept on this phone
  useEffect(() => {
    if (!signedIn || sample || mine) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("resume")) return;
    url.searchParams.delete("resume");
    window.history.replaceState(null, "", url.pathname + url.search);
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { answers?: Answers; about?: Partial<About> } | null;
      if (!d?.answers || !d.about || aboutProblem(d.about, pact)) return;
      setAnswers(d.answers);
      setAbout(d.about);
      setStep("finish");
      // School and company pacts still need the school email typed in; everyone else joins straight away
      if (!pact.email_domain) submit(undefined, { answers: d.answers, about: d.about });
    } catch {
      /* nothing kept */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up where you left off (on this phone)
  useEffect(() => {
    if (mine || sample) return;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (d?.answers) setAnswers(d.answers);
      if (d?.about) setAbout(d.about);
      if (savedPactTokens().some((t) => t.slug === pact.slug)) setTaken(true);
    } catch {
      /* nothing saved */
    }
  }, [draftKey, mine, sample, pact.slug]);
  useEffect(() => {
    if (sample) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, about }));
    } catch {
      /* private mode */
    }
  }, [answers, about, draftKey, sample]);

  const q = questions[qi];
  const total = questions.length;
  const answer = (id: string, v: Answer, advance = false) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (advance) setTimeout(next, 260);
  };
  function next() {
    setError(null);
    if (step === "intro") {
      if (taken && signedIn) return (setEditing(true), setStep("edit"));
      return setStep(questions.length ? "q" : "about");
    }
    if (editing && step === "q") return setStep("edit");
    if (editing && step === "about") {
      const msg = aboutProblem(about, pact);
      if (msg) return setError(msg);
      return setStep("edit");
    }
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
    if (step === "edit") return setStep("intro");
    if (editing && (step === "q" || step === "about")) return setStep("edit");
    if (step === "q") return qi > 0 ? setQi((i) => i - 1) : setStep("intro");
    if (step === "about") return questions.length ? (setStep("q"), setQi(total - 1)) : setStep("intro");
    if (step === "finish") return setStep("about");
  }

  async function submit(e?: React.FormEvent, draft?: { answers: Answers; about: Partial<About> }) {
    e?.preventDefault();
    if (sample) return setStep("done");
    if (!signedIn) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pacts/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: pact.slug, about: draft?.about ?? about, answers: draft?.answers ?? answers, email: pact.email_domain ? email : undefined }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Check your connection and try again." };
    setBusy(false);
    if (!res?.ok || !data.token) return setError(data.error ?? "Something went wrong. Please try again.");
    setConfirmTo(data.confirm ? email || "your" : null);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* private mode */
    }
    if (!taken) setJoined((n) => n + 1);
    setSavedEdit(editing && taken);
    setTaken(true);
    setStep("done");
    // So Home and this page show your saved answers next time
    router.refresh();
  }

  // ---------------------------------------------------------------- reveal night
  // Answers closed: matching until reveal night
  if ((phase === "closed" || phase === "matching") && !demoStep) {
    return (
      <Shell pact={pact}>
        <PactMatching pact={pact} count={joined} taken={taken} />
      </Shell>
    );
  }
  if (phase === "revealed" && !demoStep) {
    return (
      <Shell pact={pact}>
        {result ? (
          <PactReveal pact={pact} view={result} signedIn={signedIn} total={joined} preview={preview} />
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
          <Countdown to={pact.closes_at} accent={accent} label="Answers close in" />
          <div className="mt-3.5 flex items-center justify-center gap-2.5 border-t border-white/10 pt-3 text-[14px] font-semibold">
            <span className="flex">
              {["#5b3fd9,#1f9d6b", "#e5484d,#f2b33d", "#7cc8ff,#2b2066"].map((g, i) => (
                <span key={g} className="h-[26px] w-[26px] rounded-full border-2 border-[#22163f]" style={{ background: `linear-gradient(135deg, ${g})`, marginLeft: i ? -8 : 0 }} />
              ))}
            </span>
            <span>
              <b className="tabular-nums" style={{ color: accent }}>{joined.toLocaleString()}</b> {joined === 1 ? "person has" : "people have"} answered
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
              {taken ? "You're in. Answers are closed, and your match arrives on reveal night." : "Answers are closed for this Link-Up. Reveal night is coming."}
            </p>
          ) : (
            <button onClick={next} className="h-14 rounded-full text-[16.5px] font-extrabold text-[#1c1310] transition active:scale-[0.98]" style={{ background: accent }}>
              {taken ? "Edit my answers" : pact.button_text?.trim() || "Join the Link-Up"}
            </button>
          )}
          <p className="text-center text-[12px] text-white/55">Free with a Dashpad account · answers stay private · 18+</p>
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
          <h1 className="mt-3 font-display text-[30px] font-bold">{savedEdit ? "Changes saved" : "You\u2019re in"}</h1>
          <p className="mt-1.5 text-[14.5px] text-white/75">
            <b className="tabular-nums" style={{ color: accent }}>{people(joined)}</b> so far. Your match arrives {pactDate(pact.reveal_at)}.
          </p>
        </div>
        {confirmTo && (
          <p className="mx-5 mt-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3.5 text-left text-[14px] leading-relaxed" style={{ borderColor: `${accent}66`, background: `${accent}14` }}>
            <Bell size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <span>
              <b>One more step:</b> we sent a link to {confirmTo === "your" ? "your email" : <b>{confirmTo}</b>}. Tap it to confirm it&apos;s yours. You&apos;ll only be matched once you do.
            </span>
          </p>
        )}
        <div className="mx-5 mt-6 grid gap-3 text-center">
          <p className="rounded-2xl bg-white/[0.07] px-4 py-3.5 text-[14.5px] leading-relaxed text-white/85">We&apos;ll send you a notification the moment your match drops. It also shows on your profile.</p>
          <button onClick={() => (setEditing(true), setError(null), setStep("edit"))} className="h-12 rounded-full border border-white/20 text-[15px] font-bold">Change my answers</button>
        </div>
        <div className="flex-1" />
        <div className="grid gap-2 px-5 pt-5 pb-[max(1.4rem,env(safe-area-inset-bottom))]">
          <Link href="/home" className="flex h-14 items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: accent }}>Back to Dashpad</Link>
          <ShareButton pact={pact} />
        </div>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- your answers, to change
  if (step === "edit") {
    const domain = pact.email_domain?.replace(/^@/, "");
    const aboutLine = [
      INTENTS.find((i) => i.id === about.intents?.[0])?.label,
      about.gender === "woman" ? "Woman" : about.gender === "man" ? "Man" : null,
      about.age,
      about.area,
      about.work,
    ].filter(Boolean).join(" · ");
    return (
      <Shell pact={pact}>
        <form onSubmit={submit} className="flex min-h-full min-w-0 flex-1 flex-col px-4 pt-4 pb-32">
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <button type="button" onClick={back} aria-label="Back" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.08]">
              <ArrowLeft size={20} />
            </button>
            <PactLogo pact={pact} size={32} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white/80">{pact.name}</span>
          </div>
          <h1 className="mt-5 px-1 font-display text-[27px] leading-tight font-bold">Your answers</h1>
          <p className="mt-1 px-1 text-[14px] text-white/65">Tap any answer to change it, then save.</p>
          <ul className="mt-4 grid min-w-0 grid-cols-1 gap-2">
            {questions.map((qq, i) => (
              <li key={qq.id} className="min-w-0">
                <button type="button" onClick={() => (setError(null), setQi(i), setStep("q"))} className="flex w-full min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 text-left transition active:bg-white/[0.1]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-white/55">{qq.title}</span>
                    <span className="line-clamp-2 block text-[15px] leading-snug font-bold break-words">{answerLabel(qq, answers[qq.id]) || <span className="text-[#ffb4b4]">Not answered</span>}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-white/40" />
                </button>
              </li>
            ))}
            <li className="min-w-0">
              <button type="button" onClick={() => (setError(null), setStep("about"))} className="flex w-full min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 text-left transition active:bg-white/[0.1]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-white/55">About you</span>
                  <span className="line-clamp-2 block text-[15px] leading-snug font-bold break-words">{aboutLine || "Not filled in"}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-white/40" />
              </button>
            </li>
          </ul>
          {domain && (
            <label className="mt-4 grid gap-2 px-1">
              <span className="text-[13px] font-bold">Your {domain} email</span>
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${domain}`} className="rounded-2xl border border-white/20 bg-white/[0.06] px-4 text-[16px] outline-none focus:border-white/50" style={{ height: 52 }} />
            </label>
          )}
          <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-t from-[#160d2e] via-[#160d2e] to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-3 rounded-2xl bg-[#e5484d]/15 px-4 py-3 text-[14px] font-semibold text-[#ffb4b4]" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            onClick={(e) => {
              const missing = questions.find((qq) => !answered(qq, answers[qq.id]));
              const msg = missing ? `Answer "${missing.title}".` : aboutProblem(about, pact);
              if (msg) {
                e.preventDefault();
                setError(msg);
              }
            }}
            className="h-14 w-full rounded-full text-[16.5px] font-extrabold text-[#1c1310] shadow-lift disabled:opacity-60"
            style={{ background: accent }}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          </div>
        </form>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- questions, about you, finish
  /** After signing up or logging in, come back here and join with the answers kept on this phone */
  const backAfterJoin = (e: React.MouseEvent) => {
    // Previews just move on
    if (sample) {
      e.preventDefault();
      return setStep("done");
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, about }));
      localStorage.setItem(AFTER_JOIN, `/link/${pact.slug}?resume=1`);
    } catch {
      /* private mode */
    }
  };
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
        {step === "finish" && signedIn && (
          <div className="mt-6 px-1">
            <p className="text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color: accent }}>Last step</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight font-bold">{busy ? "Joining…" : "Ready to join?"}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/72">Your match shows up in Dashpad on reveal night, with a notification. Your answers also go into your profile, and you can change them anytime.</p>
            {pact.email_domain && (
              <label className="mt-5 grid gap-2">
                <span className="text-[13px] font-bold">Your {pact.email_domain.replace(/^@/, "")} email</span>
                <input
                  id="pact-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${pact.email_domain.replace(/^@/, "")}`}
                  className="rounded-2xl border border-white/20 bg-white/[0.06] px-4 text-[16px] outline-none focus:border-white/50"
                  style={{ height: 52 }}
                />
                <span className="text-[12.5px] text-white/60">This Link-Up is only for {pact.email_domain.replace(/^@/, "")} emails. We&apos;ll send a link there to confirm it&apos;s yours.</span>
              </label>
            )}
          </div>
        )}
        {step === "finish" && !signedIn && (
          <div className="mt-6 px-1">
            <p className="text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color: accent }}>Last step</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight font-bold">Create your free account to join</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/72">Your answers are kept on this phone. Once you&apos;re in, they&apos;re added to the Link-Up straight away, and your match shows up in Dashpad on reveal night.</p>
            <p className="mt-5 text-[13px] font-bold">While you wait for reveal night, meet people masked every hour, for</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
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
            <p className="mt-3 flex items-start gap-2 text-[12.5px] text-white/70">
              <Check size={15} className="mt-0.5 shrink-0" style={{ color: accent }} /> Your answers also fill in your profile: things about you and who you&apos;d like to meet. Change them anytime.
            </p>
          </div>
        )}

        <div className="flex-1" />
        {error && <p className="mb-3 rounded-2xl bg-[#e5484d]/15 px-4 py-3 text-[14px] font-semibold text-[#ffb4b4]" role="alert">{error}</p>}
        <div className="flex items-center justify-between gap-3 px-1 pt-3">
          <span className="text-[13px] text-white/55">{step === "q" ? (q?.kind === "choose_many" ? `${(answers[q.id] as string[] | undefined)?.length ?? 0} of up to ${q.max_pick}` : "No wrong answers") : ""}</span>
          {step === "finish" && !signedIn ? (
            <span className="grid justify-items-end gap-2">
              <Link href={`/signup?pact=${pact.slug}`} onClick={backAfterJoin} className="inline-flex h-[52px] items-center gap-2 rounded-full px-6 text-[16px] font-extrabold text-[#1c1310]" style={{ background: accent }}>
                Create my account <ArrowRight size={17} />
              </Link>
              <Link href="/login" onClick={backAfterJoin} className="text-[13px] font-bold text-white/75 underline-offset-2 hover:underline">I have an account · Log in</Link>
            </span>
          ) : step === "finish" ? (
            <button type="submit" disabled={busy} className="inline-flex h-[52px] items-center gap-2 rounded-full px-6 text-[16px] font-extrabold text-[#1c1310] disabled:opacity-60" style={{ background: accent }}>
              {busy ? "Saving…" : "Join the Link-Up"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={step === "q" && !answered(q, answers[q?.id ?? ""])}
              className="inline-flex h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-extrabold text-[#1c1310] transition disabled:opacity-35"
              style={{ background: accent }}
            >
              {editing && (step === "q" || step === "about") ? <>Done <Check size={17} /></> : <>Next <ArrowRight size={17} /></>}
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

/** An answer in words, for the "Your answers" screen */
function answerLabel(q: PactQuestion, v: Answer | undefined) {
  if (v === undefined) return "";
  if (q.kind === "scale") {
    const n = Number(v);
    return n <= 2 ? `${q.options[0]?.label ?? ""} (${n}/5)` : n >= 4 ? `${q.options[1]?.label ?? ""} (${n}/5)` : `In the middle (${n}/5)`;
  }
  const label = (id: string) => q.options.find((o) => o.id === id)?.label ?? "";
  return Array.isArray(v) ? v.map(label).filter(Boolean).join(", ") : label(String(v));
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
    const url = `${location.origin}/link/${pact.slug}`;
    const text = `I just answered ${pact.name}. Answer it too and see who you match with on reveal night.`;
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
      <Share2 size={17} /> {copied ? "Link copied" : "Share the Link-Up"}
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

const AGE_LO = 18;
const AGE_HI = 65; // the top of the slider means "65 and over"

/** Your age: a big number with − and +, and a row of ages to swipe and tap */
function AgePicker({ value, onChange, accent }: { value: number; onChange: (n: number) => void; accent: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const ages = useMemo(() => Array.from({ length: 80 - AGE_LO + 1 }, (_, i) => AGE_LO + i), []);
  // Keep the chosen age in the middle of the row
  useEffect(() => {
    const row = strip.current;
    const el = row?.querySelector<HTMLElement>(`[data-age="${value}"]`);
    if (row && el) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [value]);
  const step = (by: number) => onChange(Math.min(80, Math.max(AGE_LO, value + by)));
  return (
    <div className="min-w-0 overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.04] pt-4 pb-3">
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Younger" onClick={() => step(-1)} className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.09] transition active:scale-90"><Minus size={20} /></button>
        <div className="w-24 text-center">
          <div className="font-display text-[46px] leading-none font-bold tabular-nums" style={{ color: accent }}>{value}</div>
          <div className="mt-1 text-[12.5px] font-semibold text-white/60">years old</div>
        </div>
        <button type="button" aria-label="Older" onClick={() => step(1)} className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.09] transition active:scale-90"><Plus size={20} /></button>
      </div>
      <div className="relative mt-3">
        <div ref={strip} className="no-scrollbar flex snap-x gap-1.5 overflow-x-auto px-[45%] py-1.5">
          {ages.map((n) => {
            const on = n === value;
            return (
              <button
                key={n}
                type="button"
                data-age={n}
                aria-label={`${n} years old`}
                aria-pressed={on}
                onClick={() => onChange(n)}
                className="grid h-11 w-11 shrink-0 snap-center place-items-center rounded-full text-[15px] font-bold tabular-nums transition"
                style={on ? { background: accent, color: "#1c1310" } : { color: "rgba(255,255,255,.65)" }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1c1338] to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#1c1338] to-transparent" />
      </div>
    </div>
  );
}

const thumb =
  "pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_5px_var(--pact),0_4px_14px_rgba(0,0,0,.4)] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_0_0_5px_var(--pact),0_4px_14px_rgba(0,0,0,.4)]";

/** The ages you'd like to meet: one slider with two handles, plus quick picks */
function AgeRange({ min, max, myAge, onChange, accent }: { min: number; max: number; myAge: number; onChange: (min: number, max: number) => void; accent: string }) {
  const hi = Math.min(max, AGE_HI);
  const lo = Math.min(min, AGE_HI - 1);
  const pct = (v: number) => ((v - AGE_LO) / (AGE_HI - AGE_LO)) * 100;
  const label = (v: number) => (v >= AGE_HI ? `${AGE_HI}+` : String(v));
  const around: [number, number] = [Math.max(AGE_LO, myAge - 4), Math.min(AGE_HI, myAge + 5)];
  const presets: { t: string; v: [number, number] }[] = [
    { t: "Around my age", v: around },
    { t: "Any age", v: [AGE_LO, AGE_HI] },
  ];
  const isOn = (v: [number, number]) => lo === v[0] && hi === v[1];
  return (
    <div className="rounded-[22px] border border-white/12 bg-white/[0.04] px-5 pt-4 pb-5">
      <div className="text-center font-display text-[34px] leading-none font-bold tabular-nums">
        <span style={{ color: accent }}>{label(lo)}</span>
        <span className="mx-2 text-white/40">to</span>
        <span style={{ color: accent }}>{label(hi)}</span>
      </div>
      <div className="relative mx-1 mt-6 h-8">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/15" />
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: accent }} />
        <input type="range" aria-label="Youngest" min={AGE_LO} max={AGE_HI} value={lo} onChange={(e) => onChange(Math.min(Number(e.target.value), hi - 1), max >= AGE_HI ? 99 : hi)} className={thumb} />
        <input type="range" aria-label="Oldest" min={AGE_LO} max={AGE_HI} value={hi} onChange={(e) => { const v = Math.max(Number(e.target.value), lo + 1); onChange(lo, v >= AGE_HI ? 99 : v); }} className={thumb} />
      </div>
      <div className="mt-1 flex justify-between text-[12px] font-semibold text-white/45">
        <span>{AGE_LO}</span>
        <span>{AGE_HI}+</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <button
            key={p.t}
            type="button"
            onClick={() => onChange(p.v[0], p.v[1] >= AGE_HI ? 99 : p.v[1])}
            aria-pressed={isOn(p.v)}
            className="h-11 rounded-full border text-[14px] font-bold transition active:scale-[0.98]"
            style={isOn(p.v) ? { borderColor: accent, background: `${accent}24` } : { borderColor: "rgba(255,255,255,.16)" }}
          >
            {p.t}
          </button>
        ))}
      </div>
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
    <div className="mt-5 grid grid-cols-1 gap-5 px-1 animate-fade-in">
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
                onClick={() => set({ intents: [i.id] })}
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
        <span className="text-[12px] text-white/50">Pick one. Your match is for this.</span>
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
      <div className="grid min-w-0 grid-cols-1 gap-2">
        <span className={label}>My age</span>
        <AgePicker value={about.age ?? 25} accent={accent} onChange={(n) => set({ age: n })} />
      </div>
      <div className="grid gap-2">
        <span className={label}>I&apos;d like to meet people aged</span>
        <AgeRange min={about.ageMin ?? 21} max={about.ageMax ?? 35} myAge={about.age ?? 25} accent={accent} onChange={(ageMin, ageMax) => set({ ageMin, ageMax })} />
      </div>
      {pact.areas.length > 0 && (
        <div className="grid gap-2">
          <span className={label}>My area <span className="font-semibold tracking-normal normal-case text-white/45">(optional)</span></span>
          <div className={clsx("grid gap-2", pact.areas.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
            {pact.areas.map((a) => (
              <Chip key={a} accent={accent} on={about.area === a} onClick={() => set({ area: about.area === a ? undefined : a })}>{a}</Chip>
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
          <Link href={`/link/${pact.slug}/match?t=${mine}`} className="flex h-14 items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: pact.accent }}>See my match</Link>
        )}
        <Link href={`/login`} className="flex h-12 items-center justify-center rounded-full border border-white/20 text-[15px] font-bold">Log in to Dashpad</Link>
        {sent ? (
          <p className="flex items-center gap-2 rounded-2xl bg-white/[0.07] px-4 py-3 text-[14px] text-white/85"><Bell size={16} /> If you answered with that email, your link is on its way.</p>
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
