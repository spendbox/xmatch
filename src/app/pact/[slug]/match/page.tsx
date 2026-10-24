import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { pactPhase } from "@/lib/pacts";
import { claimEntries, loadPact, resultFor } from "@/lib/pactsServer";
import { PactReveal } from "@/components/pacts/PactReveal";
import { Countdown, PactMatching, pactDate } from "@/components/pacts/PactBits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Pact match", robots: { index: false } };

// The private link from the reveal email: your match, no login needed
export default async function PactMatchPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ slug }, { t }] = await Promise.all([params, searchParams]);
  const loaded = await loadPact(slug);
  if (!loaded || !t || !/^[0-9a-f]{64}$/.test(t)) notFound();
  const { pact, count } = loaded;
  const { user } = await getAuth();
  if (user) await claimEntries(user.id, [t]);
  const result = await resultFor(pact.id, { token: t });
  if (!result) notFound();
  return (
    <div className="min-h-dvh bg-[#0d0820] text-[#fbf4e6]">
      <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:rounded-[32px]" style={{ background: "radial-gradient(120% 60% at 50% 0%, #3b2585 0%, #160d2e 60%)" }}>
        {pactPhase(pact) === "closed" || pactPhase(pact) === "matching" ? (
          <PactMatching pact={pact} count={count} taken />
        ) : pactPhase(pact) !== "revealed" ? (
          <div className="flex flex-1 flex-col justify-center gap-6 px-6 text-center">
            <h1 className="font-display text-[30px] font-bold">You&apos;re in {pact.name}</h1>
            <Countdown to={pact.reveal_at} accent={pact.accent} label="Your match arrives in" />
            <p className="text-[14px] text-white/70">Reveal night: {pactDate(pact.reveal_at)}. Keep this link, it shows your match.</p>
            <Link href={`/pact/${pact.slug}`} className="mx-auto flex h-12 items-center rounded-full border border-white/20 px-6 text-[15px] font-bold">Back to the Pact</Link>
          </div>
        ) : (
          <PactReveal pact={pact} view={result.view} signedIn={!!user && result.signedIn} total={count} token={t} />
        )}
      </div>
    </div>
  );
}
