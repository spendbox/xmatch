import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export function LegalPage({
  title,
  updated,
  summary,
  sections,
  other,
}: {
  title: string;
  updated: string;
  summary: string[];
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
        <div className="absolute -top-28 -left-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -top-10 -right-24 h-72 w-72 rounded-full bg-[#ff8fb8]/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl px-5 pb-16">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold">
            <ArrowLeft size={16} /> Home
          </Link>
        </header>

        <p className="mt-4 text-[13px] font-semibold tracking-wide text-brand uppercase">Legal</p>
        <h1 className="mt-1 font-display text-[36px] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] text-muted">Last updated {updated}</p>

        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[16px] font-semibold">The short version</h2>
          <ul className="mt-3 space-y-2.5">
            {summary.map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-soft text-mint">
                  <Check size={12} strokeWidth={3} />
                </span>
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-muted">This summary is for convenience. The full text below is what applies.</p>
        </section>

        <nav aria-label="Contents" className="mt-6">
          <p className="mb-2 text-[13px] font-semibold text-muted">Contents</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:border-brand hover:text-brand">
                {i + 1}. {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-[20px] font-semibold">
                <span className="mr-2 text-brand">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="legal mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl bg-ink p-6 text-center text-white">
          <p className="text-[15px]">Questions? Email us at <a className="font-semibold text-gold" href="mailto:support@dashpad.site">support@dashpad.site</a></p>
          <Link href={other.href} className="text-[14px] font-semibold text-white/80 underline underline-offset-4">
            Read our {other.label}
          </Link>
        </div>
      </div>
    </main>
  );
}
