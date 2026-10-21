import { Logo } from "@/components/ui/Logo";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe">
      <header className="py-5">
        <Logo />
      </header>
      <div className="pt-6 animate-fade-up">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[16px] text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
      <p className="mt-auto pt-10 pb-4 text-center text-[15px] text-muted">{footer}</p>
    </main>
  );
}
