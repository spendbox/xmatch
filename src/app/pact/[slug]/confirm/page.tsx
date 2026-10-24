import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmEntry } from "@/lib/pactsServer";
import { PactLogo, pactDate } from "@/components/pacts/PactBits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email confirmed", robots: { index: false } };

// The link from a school or company pact's confirmation email
export default async function PactConfirmPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const [{ slug }, { c }] = await Promise.all([params, searchParams]);
  const pact = c ? await confirmEntry(slug, c) : null;
  if (!pact) notFound();
  return (
    <div className="min-h-dvh bg-[#0d0820] text-[#fbf4e6]">
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center" style={{ background: "radial-gradient(120% 60% at 50% 0%, #3b2585 0%, #160d2e 60%)" }}>
        <PactLogo pact={pact} size={80} />
        <h1 className="mt-6 font-display text-[32px] leading-tight font-bold">Email confirmed</h1>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/75">You&apos;re in {pact.name}. Your match arrives on reveal night, {pactDate(pact.reveal_at)}.</p>
        <Link href={`/pact/${pact.slug}`} className="mt-8 flex h-14 w-full max-w-sm items-center justify-center rounded-full text-[16px] font-extrabold text-[#1c1310]" style={{ background: pact.accent }}>
          Back to the Pact
        </Link>
      </div>
    </div>
  );
}
