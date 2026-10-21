import { Clock3, EyeOff, HeartHandshake } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badge,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-x-clip lg:grid lg:grid-cols-2">
      {/* Brand panel — computers only */}
      <BrandPanel />

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden lg:hidden">
          <div className="absolute -top-28 -left-20 h-72 w-72 animate-blob rounded-full bg-brand/25 blur-3xl" />
          <div className="absolute top-10 -right-24 h-72 w-72 animate-blob rounded-full bg-[#ff8fb8]/25 blur-3xl [animation-delay:-6s]" />
        </div>

        <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe lg:justify-center lg:py-12">
          <header className="py-5 lg:hidden">
            <Logo />
          </header>

          <div className="pt-4 animate-fade-up lg:pt-0">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid h-14 w-14 animate-float place-items-center rounded-2xl bg-ink text-white shadow-lift">
                <MaskIcon className="w-9" eyes="#1c1828" />
              </span>
              {badge}
            </div>
            <h1 className="mt-5 font-display text-[34px] leading-[1.1] font-semibold tracking-tight lg:mt-0 lg:text-[42px]">{title}</h1>
            <p className="mt-2 text-[16px] leading-relaxed text-muted">{subtitle}</p>
          </div>

          <div className="mt-7 animate-fade-up rounded-[30px] border border-white/80 bg-surface/90 p-5 shadow-[0_20px_50px_-24px_rgb(28_24_40/0.3)] backdrop-blur [animation-delay:80ms] lg:p-7">
            {children}
          </div>

          {footer && <p className="mt-auto pt-8 pb-4 text-center text-[15px] text-muted lg:mt-6 lg:pt-0">{footer}</p>}
        </div>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand via-[#6d4ff0] to-[#a35bd8] p-12 text-white lg:flex lg:flex-col">
      <div aria-hidden className="absolute -top-24 -right-24 h-96 w-96 animate-blob rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute -bottom-32 -left-20 h-96 w-96 animate-blob rounded-full bg-gold/30 blur-3xl [animation-delay:-6s]" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
          <MaskIcon className="w-7 text-white" eyes="#6d4ff0" />
          <span className="font-display text-[22px] font-semibold">Dashpad</span>
        </span>
      </div>

      <div className="relative my-auto max-w-lg">
        <span className="grid h-28 w-28 animate-float place-items-center rounded-[32px] bg-white/15 shadow-lift backdrop-blur">
          <MaskIcon className="w-[72px] text-white" eyes="#6d4ff0" />
        </span>
        <h2 className="mt-10 font-display text-[56px] leading-[1.02] font-semibold">
          Match on <em className="text-gold">vibes</em>, not looks.
        </h2>
        <ul className="mt-10 space-y-4 text-[17px]">
          {[
            { icon: <Clock3 size={20} />, text: "Five minutes of masked conversation" },
            { icon: <EyeOff size={20} />, text: "No names or photos until you both unmask" },
            { icon: <HeartHandshake size={20} />, text: "If it's not mutual, the chat disappears" },
          ].map((f) => (
            <li key={f.text} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-[13px] text-white/70">© {new Date().getFullYear()} Dashpad · 18+ only</p>
    </aside>
  );
}
