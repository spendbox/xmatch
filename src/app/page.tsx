import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Clock, HeartHandshake, MessageCircleHeart, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: MessageCircleHeart,
    title: "Chat masked",
    body: "Get paired with someone who wants what you want. No photos, no names — just conversation.",
  },
  {
    icon: Clock,
    title: "Five minutes",
    body: "Icebreakers set the mood, from mild to naughty. You both pick, the questions meet in the middle.",
  },
  {
    icon: HeartHandshake,
    title: "Unmask together",
    body: "If you both choose to unmask, it's a match. If not, the chat disappears for good.",
  },
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <ButtonLink href="/login" variant="ghost" className="h-10 px-4">
          Log in
        </ButtonLink>
      </header>

      <section className="pt-6 text-center">
        <div className="relative mx-auto mb-8 grid h-36 w-36 place-items-center">
          <span className="absolute inset-0 rounded-full bg-brand/15 animate-pulse-ring" />
          <span className="absolute inset-3 rounded-full bg-brand-soft" />
          <span className="relative grid h-24 w-24 place-items-center rounded-full bg-brand text-white shadow-lift animate-float">
            <MaskIcon className="w-14" eyes="#5b3fd9" />
          </span>
        </div>
        <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-tight text-ink">
          Meet the person <em className="text-brand">before</em> the picture.
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-[17px] leading-relaxed text-muted">
          Five minutes, both masked. Unmask only if you both say yes.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink href="/signup" size="lg">
            Create your account
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            I already have one
          </ButtonLink>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-center text-sm font-semibold tracking-wide text-muted uppercase">
          How Masquerade works
        </h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-3xl bg-surface p-5 shadow-card">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <s.icon size={22} />
              </span>
              <div>
                <p className="font-semibold text-ink">
                  <span className="mr-1.5 text-muted">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 flex items-start gap-3 rounded-3xl bg-mint-soft p-5">
        <ShieldCheck className="mt-0.5 shrink-0 text-mint" size={22} />
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Be kind. You can leave or report anyone at any time, and nobody sees your profile unless you both unmask.
        </p>
      </section>

      <footer className="mt-auto pt-12 pb-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Dashpad · dashpad.site · 18+ only
      </footer>
    </main>
  );
}
