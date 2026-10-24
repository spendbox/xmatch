import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { pactPhase, type About, type Answers } from "@/lib/pacts";
import { claimEntries, loadPact, resultFor } from "@/lib/pactsServer";
import { PactFlow } from "@/components/pacts/PactFlow";
import { AdminPreview } from "@/components/pacts/AdminPreview";

export const dynamic = "force-dynamic";

type Search = Promise<{ preview?: string; as?: string }>;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const loaded = await loadPact(slug, { drafts: !!preview && (await isAdmin()) });
  if (!loaded) return { title: "Pact" };
  const { pact } = loaded;
  const description = pact.tagline || `Answer a few questions. On reveal night, everyone gets their one best match.`;
  return {
    title: pact.name,
    description,
    openGraph: { title: pact.name, description, images: pact.header_url ? [pact.header_url] : undefined },
    ...(preview ? { robots: { index: false } } : {}),
  };
}

export default async function PactPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  // Admins can see any pact, drafts too, at each stage, without anything being saved
  const preview = !!sp.preview && (await isAdmin());
  const loaded = await loadPact(slug, { drafts: preview });
  if (!loaded) notFound();
  const { pact, questions, count } = loaded;
  if (preview) return <AdminPreview pact={pact} questions={questions} count={count} as={sp.as} />;

  const { user } = await getAuth();
  let mine: { about: About; answers: Answers } | null = null;
  let result = null;
  if (user) {
    await claimEntries(user.id, user.email);
    const { data } = await createAdminClient().from("pact_entries").select("about, answers").eq("pact_id", pact.id).eq("user_id", user.id).maybeSingle();
    if (data) mine = data as { about: About; answers: Answers };
    if (pactPhase(pact) === "revealed" && mine) result = await resultFor(pact.id, { userId: user.id });
  }
  return <PactFlow pact={pact} questions={questions} count={count} signedIn={!!user} mine={mine} result={result?.view ?? null} />;
}
