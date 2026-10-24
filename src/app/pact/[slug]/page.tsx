import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pactPhase, type About, type Answers } from "@/lib/pacts";
import { claimEntries, loadPact, resultFor, revealPact } from "@/lib/pactsServer";
import { PactFlow } from "@/components/pacts/PactFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPact(slug);
  if (!loaded) return { title: "Pact" };
  const { pact } = loaded;
  const description = pact.tagline || `Answer a few questions. On reveal night, everyone gets their one best match.`;
  return {
    title: pact.name,
    description,
    openGraph: { title: pact.name, description, images: pact.header_url ? [pact.header_url] : undefined },
  };
}

export default async function PactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let loaded = await loadPact(slug);
  if (!loaded) notFound();
  // The first visit after reveal time does the matching (the 5-minute job does it too)
  if (pactPhase(loaded.pact) === "revealed" && !loaded.pact.matched_at) {
    await revealPact(loaded.pact.id);
    loaded = (await loadPact(slug))!;
  }
  const { pact, questions, count } = loaded;
  const { user } = await getAuth();
  let mine: { about: About; answers: Answers } | null = null;
  let result = null;
  if (user) {
    await claimEntries(user.id, user.email);
    const { data } = await createAdminClient().from("pact_entries").select("about, answers").eq("pact_id", pact.id).eq("user_id", user.id).maybeSingle();
    if (data) mine = data as { about: About; answers: Answers };
    if (pactPhase(pact) === "revealed" && mine) result = await resultFor(pact.id, { userId: user.id });
  }
  return <PactFlow pact={pact} questions={questions} count={count} signedIn={!!user} mine={mine} result={result ? { match: result.match } : null} />;
}
