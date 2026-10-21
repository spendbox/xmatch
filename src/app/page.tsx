import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { ChiliIcon, INTENT_ICONS, InterestIcon, MaskLineIcon } from "@/components/ui/icons";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Reveal } from "@/components/landing/Reveal";
import { ScrollToTop } from "@/components/landing/ScrollToTop";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { ArrowRight, Clock3, EyeOff, Handshake, MapPin, ShieldCheck } from "lucide-react";

const VIBE_SIGNALS = [
  {
    icon: <Handshake size={22} strokeWidth={1.75} />,
    tone: "bg-brand-soft text-brand",
    title: "Same intentions",
    body: "Friends, dating or something spicier — you only meet people who want what you want.",
  },
  {
    icon: <InterestIcon name="Music" size={22} />,
    tone: "bg-[#fde8f1] text-[#c2306b]",
    title: "Shared interests",
    body: "People who love the things you love are matched with you first.",
  },
  {
    icon: <ChiliIcon size={22} />,
    tone: "bg-chili-soft text-chili",
    title: "Spice that fits",
    body: "Pick how bold the icebreakers get. The questions meet you both in the middle.",
  },
  {
    icon: <MapPin size={22} strokeWidth={1.75} />,
    tone: "bg-mint-soft text-mint",
    title: "Close by",
    body: "The nearest good match comes first, so meeting up is easy.",
  },
];

const MODES = [
  { key: "friends", title: "Friends", body: "New people to laugh, eat and explore with.", tone: "from-[#efebfd] to-[#f7f5ff] text-brand" },
  { key: "dating", title: "Dating", body: "Real chemistry before you see a single photo.", tone: "from-[#fde8f1] to-[#fff5f9] text-[#c2306b]" },
  { key: "spicy", title: "Spicy link-up", body: "Flirty, bold and fun — if you both feel it.", tone: "from-[#fdecec] to-[#fff6f4] text-chili" },
] as const;

const STEPS = [
  { icon: <MaskLineIcon size={20} />, title: "Put on your mask", body: "Choose your vibe in a few taps." },
  { icon: <Clock3 size={20} strokeWidth={1.75} />, title: "Chat for 5 minutes", body: "No names, no photos. Just energy." },
  { icon: <Handshake size={20} strokeWidth={1.75} />, title: "Unmask together", body: "Both say yes? It's a match. If not, the chat vanishes." },
];

export default function Landing() {
  const row1 = INTEREST_OPTIONS.slice(0, 11);
  const row2 = INTEREST_OPTIONS.slice(11);

  return (
    <main className="relative overflow-x-clip">
      <ScrollToTop />
      {/* Soft moving colour in the background */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 animate-blob rounded-full text-brand/25 glow" />
        <div className="absolute top-40 -right-28 h-80 w-80 animate-blob rounded-full text-[#ff8fb8]/25 glow [animation-delay:-5s]" />
        <div className="absolute top-[520px] left-10 h-72 w-72 animate-blob rounded-full text-gold/25 glow [animation-delay:-9s]" />
      </div>

      <div className="relative mx-auto max-w-md px-5 pb-safe md:max-w-3xl lg:max-w-6xl lg:px-10">
        <header className="flex items-center justify-between py-5 lg:py-7">
          <Logo />
          <nav className="hidden items-center gap-8 text-[15px] font-medium text-ink-soft lg:flex" aria-label="Sections">
            <a href="#how" className="hover:text-brand">How it works</a>
            <a href="#moods" className="hover:text-brand">Moods</a>
            <a href="#safety" className="hover:text-brand">Safety</a>
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="secondary" className="h-10 rounded-full px-4 text-[14px]">
              Log in
            </ButtonLink>
            <ButtonLink href="/signup" className="hidden h-10 rounded-full px-5 text-[14px] lg:inline-flex">
              Join free
            </ButtonLink>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-10 lg:pb-8">
        {/* Hero */}
        <section className="pt-4 text-center lg:pt-0 lg:text-left">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-brand/15 bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-brand shadow-card">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            Masked chats happening now
          </span>
          <h1 className="mt-5 animate-fade-up font-display text-[44px] leading-[1.02] font-semibold tracking-tight [animation-delay:80ms] md:text-[56px] lg:text-[68px]">
            Match on{" "}
            <span className="relative inline-block">
              <em className="bg-gradient-to-r from-brand via-[#c2306b] to-[#e8962a] bg-clip-text pr-1 text-transparent">Vibes</em>
              <svg aria-hidden viewBox="0 0 120 12" className="absolute -bottom-1 left-0 w-full text-gold" preserveAspectRatio="none">
                <path d="M2 9c30-6 80-8 116-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-[22rem] animate-fade-up text-[17px] leading-relaxed text-muted [animation-delay:160ms] lg:mx-0 lg:max-w-md lg:text-[19px]">
            Dashpad pairs you with people who match your energy. Chat masked for five minutes — if you click, you both unmask.
          </p>
          <div className="mt-7 flex animate-fade-up flex-col gap-3 [animation-delay:240ms] lg:mt-9 lg:items-start">
            <ButtonLink href="/signup" size="lg" loadingText="Opening…" className="lg:w-auto lg:px-10">
              Find your vibe <ArrowRight size={18} />
            </ButtonLink>
            <p className="text-[13px] text-muted">Free to join · 18+ · Takes a minute</p>
          </div>
        </section>

        {/* Live demo */}
        <section className="mt-10 animate-fade-up [animation-delay:320ms] lg:mt-0">
          <LiveDemo />
        </section>
        </div>
      </div>

      {/* Interest marquee */}
      <section className="relative mt-14" aria-label="Interests on Dashpad">
        <p className="mb-4 text-center text-[13px] font-semibold tracking-wide text-muted uppercase">Find people who love what you love</p>
        <div className="space-y-2.5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          {[row1, row2].map((row, r) => (
            <div key={r} className="flex overflow-hidden">
              <div className={"flex shrink-0 animate-marquee gap-2.5 pr-2.5 " + (r === 1 ? "[animation-direction:reverse]" : "")}>
                {[...row, ...row].map((t, i) => (
                  <span key={i} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink-soft shadow-card">
                    <InterestIcon name={t} size={17} className="text-brand" /> {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="relative mx-auto max-w-md px-5 pb-safe md:max-w-3xl lg:max-w-6xl lg:px-10">
        {/* How vibe matching works */}
        <section id="how" className="mt-16 scroll-mt-8 lg:mt-24">
          <Reveal>
            <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">Vibe matching</p>
            <h2 className="mt-1 font-display text-[30px] leading-tight font-semibold lg:text-[44px]">How we find your person</h2>
          </Reveal>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-10 lg:grid-cols-4 lg:gap-5">
            {VIBE_SIGNALS.map((v, i) => (
              <Reveal key={v.title} delay={i * 80}>
                <div className="h-full rounded-3xl border border-line bg-surface p-4 shadow-card">
                  <span className={"grid h-11 w-11 place-items-center rounded-[14px] " + v.tone}>{v.icon}</span>
                  <p className="mt-3 text-[15px] font-semibold">{v.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Modes */}
        <section id="moods" className="mt-16 scroll-mt-8 lg:mt-24">
          <Reveal>
            <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">Your call</p>
            <h2 className="mt-1 font-display text-[30px] leading-tight font-semibold lg:text-[44px]">What are you in the mood for?</h2>
          </Reveal>
          <div className="mt-6 space-y-3 lg:mt-10 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0">
            {MODES.map((m, i) => (
              <Reveal key={m.key} delay={i * 80}>
                <div className={"flex h-full items-center gap-4 rounded-3xl bg-gradient-to-br p-5 lg:flex-col lg:items-start lg:p-7 " + m.tone}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-card">
                    {INTENT_ICONS[m.key]({ size: 24 })}
                  </span>
                  <div>
                    <p className="text-[17px] font-semibold text-ink">{m.title}</p>
                    <p className="text-[14px] text-ink-soft">{m.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mt-16 lg:mt-24">
          <Reveal>
            <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">The Masquerade</p>
            <h2 className="mt-1 font-display text-[30px] leading-tight font-semibold lg:text-[44px]">Three steps to a real spark</h2>
          </Reveal>
          <ol className="relative mt-6 space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[21px] before:w-0.5 before:bg-gradient-to-b before:from-brand before:to-gold lg:mt-10 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:before:top-[21px] lg:before:right-[16%] lg:before:bottom-auto lg:before:left-[8%] lg:before:h-0.5 lg:before:w-auto lg:before:bg-gradient-to-r">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <li className="relative flex gap-4 lg:flex-col lg:gap-5">
                  <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white ring-4 ring-cream">
                    {s.icon}
                  </span>
                  <div className="pt-1">
                    <p className="text-[16px] font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Safety */}
        <Reveal className="mt-14 lg:mt-24">
          <section id="safety" className="grid scroll-mt-8 grid-cols-3 gap-2.5 text-center lg:gap-5">
            {[
              { icon: <EyeOff size={20} strokeWidth={1.75} />, text: "Photos hidden till you both unmask" },
              { icon: <ShieldCheck size={20} strokeWidth={1.75} />, text: "Leave or report any time" },
              { icon: <MapPin size={20} strokeWidth={1.75} />, text: "Exact location never shown" },
            ].map((f) => (
              <div key={f.text} className="rounded-3xl bg-surface p-3.5 shadow-card lg:p-7">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-mint-soft text-mint">{f.icon}</span>
                <p className="mt-2 text-[12px] leading-snug font-medium text-ink-soft lg:mt-4 lg:text-[16px]">{f.text}</p>
              </div>
            ))}
          </section>
        </Reveal>

        {/* Final call to action */}
        <Reveal className="mt-14">
          <section className="relative overflow-hidden rounded-[32px] bg-ink px-6 py-10 text-center text-white lg:rounded-[40px] lg:py-20">
            <div aria-hidden className="absolute -top-16 -left-10 h-48 w-48 animate-blob rounded-full text-brand/60 glow" />
            <div aria-hidden className="absolute -right-10 -bottom-16 h-48 w-48 animate-blob rounded-full text-[#c2306b]/50 glow [animation-delay:-6s]" />
            <div className="relative">
              <span className="mx-auto grid h-16 w-16 animate-float place-items-center rounded-2xl bg-white/10 backdrop-blur">
                <MaskIcon className="w-11 text-white" eyes="#1c1828" />
              </span>
              <h2 className="mt-5 font-display text-[30px] leading-tight font-semibold lg:text-[52px]">Your vibe is waiting.</h2>
              <p className="mx-auto mt-2 max-w-xs text-[15px] text-white/70">Five minutes could change your whole week.</p>
              <ButtonLink href="/signup" variant="gold" size="lg" className="mt-6 lg:w-auto lg:px-12" loadingText="Opening…">
                Put on your mask
              </ButtonLink>
              <ButtonLink href="/login" variant="ghost" className="mt-2 w-full text-white/80 hover:bg-white/10 lg:mx-auto lg:flex lg:w-auto">
                I already have an account
              </ButtonLink>
            </div>
          </section>
        </Reveal>

        <footer className="py-10 text-center text-xs text-muted">
          <div className="mb-2 flex justify-center gap-4 text-[13px] font-medium">
            <a href="/terms" className="hover:text-brand">Terms</a>
            <a href="/privacy" className="hover:text-brand">Privacy</a>
            <a href="mailto:support@dashpad.site" className="hover:text-brand">Contact</a>
          </div>
          © {new Date().getFullYear()} Dashpad · dashpad.site · 18+ only
        </footer>
      </div>
    </main>
  );
}
