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
    <main className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-28 -left-20 h-72 w-72 animate-blob rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute top-10 -right-24 h-72 w-72 animate-blob rounded-full bg-[#ff8fb8]/25 blur-3xl [animation-delay:-6s]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe">
        <header className="py-5">
          <Logo />
        </header>

        <div className="pt-4 animate-fade-up">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 animate-float place-items-center rounded-2xl bg-ink text-white shadow-lift">
              <MaskIcon className="w-9" eyes="#1c1828" />
            </span>
            {badge}
          </div>
          <h1 className="mt-5 font-display text-[34px] leading-[1.1] font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-muted">{subtitle}</p>
        </div>

        <div className="mt-7 animate-fade-up rounded-[30px] border border-white/80 bg-surface/90 p-5 shadow-[0_20px_50px_-24px_rgb(28_24_40/0.3)] backdrop-blur [animation-delay:80ms]">
          {children}
        </div>

        {footer && <p className="mt-auto pt-8 pb-4 text-center text-[15px] text-muted">{footer}</p>}
      </div>
    </main>
  );
}
