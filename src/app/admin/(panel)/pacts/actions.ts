"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { INTENTS, MAX_QUESTIONS, SEED_QUESTIONS, type PactIntent, type PactQuestion, type QuestionKind, type Weight } from "@/lib/pacts";
import { runReveal } from "@/lib/pactsServer";

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** A new draft pact with the seed questions, opening now and revealing in two weeks */
export async function createPact(name: string, slug: string): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  const n = clean(name, 60);
  const s = slugify(slug || n);
  if (n.length < 2) return { error: "Give the pact a name." };
  if (s.length < 2) return { error: "Choose a link for the pact." };
  const db = createAdminClient();
  const { data: taken } = await db.from("pacts").select("id").eq("slug", s).maybeSingle();
  if (taken) return { error: `dashpad.site/pact/${s} is already taken. Try another link.` };
  const closes = new Date(Date.now() + 12 * 86400_000);
  const reveal = new Date(Date.now() + 14 * 86400_000);
  const { data, error } = await db.from("pacts").insert({ name: n, slug: s, areas: [], closes_at: closes.toISOString(), reveal_at: reveal.toISOString() }).select("id").single();
  if (error || !data) return { error: "Couldn't create the pact. Please try again." };
  await db.from("pact_questions").insert(SEED_QUESTIONS.map((q, i) => ({ ...q, pact_id: data.id, position: i })));
  revalidatePath("/admin/pacts");
  return { id: data.id as string };
}

export type PactDetails = {
  name: string;
  slug: string;
  tagline: string;
  logo_url: string | null;
  header_url: string | null;
  accent: string;
  intents: PactIntent[];
  areas: string[];
  email_domain: string | null;
  closes_at: string;
  reveal_at: string;
};

export async function savePactDetails(id: string, d: PactDetails): Promise<{ error?: string }> {
  await requireAdmin();
  const name = clean(d.name, 60);
  const slug = slugify(d.slug);
  if (name.length < 2) return { error: "Give the pact a name." };
  if (slug.length < 2) return { error: "Choose a link for the pact." };
  const intents = INTENTS.map((i) => i.id).filter((i) => d.intents.includes(i));
  if (!intents.length) return { error: "Pick at least one thing people can be matched for." };
  const closes = new Date(d.closes_at), reveal = new Date(d.reveal_at);
  if (isNaN(+closes) || isNaN(+reveal)) return { error: "Set when answers close and when the reveal is." };
  if (reveal < closes) return { error: "Reveal night has to be after answers close." };
  const accent = /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : "#f2c45a";
  const areas = [...new Set(d.areas.map((a) => clean(a, 30)).filter(Boolean))].slice(0, 8);
  const domain = clean(d.email_domain ?? "", 60).replace(/^@/, "").toLowerCase() || null;
  const url = (u: string | null) => (u && /^https:\/\//.test(u) ? u.slice(0, 500) : null);
  const db = createAdminClient();
  const { data: taken } = await db.from("pacts").select("id").eq("slug", slug).neq("id", id).maybeSingle();
  if (taken) return { error: `dashpad.site/pact/${slug} is already taken. Try another link.` };
  const { error } = await db
    .from("pacts")
    .update({ name, slug, tagline: clean(d.tagline, 160), logo_url: url(d.logo_url), header_url: url(d.header_url), accent, intents, areas, email_domain: domain, closes_at: closes.toISOString(), reveal_at: reveal.toISOString() })
    .eq("id", id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/admin/pacts");
  revalidatePath(`/admin/pacts/${id}`);
  return {};
}

const KINDS: QuestionKind[] = ["this_or_that", "choose_one", "choose_many", "scale"];
const WEIGHTS: Weight[] = ["normal", "strong", "dealbreaker"];

/** Saves the questions in order. Existing questions keep their ids, so earlier answers still count. */
export async function savePactQuestions(id: string, list: PactQuestion[]): Promise<{ error?: string }> {
  await requireAdmin();
  if (!list.length) return { error: "Add at least one question." };
  if (list.length > MAX_QUESTIONS) return { error: `A pact can have up to ${MAX_QUESTIONS} questions.` };
  const rows = [];
  for (const [i, q] of list.entries()) {
    const kind = KINDS.includes(q.kind) ? q.kind : "this_or_that";
    const title = clean(q.title, 90);
    if (title.length < 2) return { error: `Question ${i + 1} needs a title.` };
    const seen = new Set<string>();
    const options = (q.options ?? [])
      .map((o) => ({ id: clean(o.id, 12) || Math.random().toString(36).slice(2, 8), label: clean(o.label, 60), image: o.image && (/^https:\/\//.test(o.image) || /^\/pacts\/art\/[a-z-]+\.svg$/.test(o.image)) ? o.image.slice(0, 500) : null }))
      .filter((o) => o.label && !seen.has(o.id) && seen.add(o.id));
    const need = kind === "this_or_that" || kind === "scale" ? 2 : 2;
    if (options.length < need) return { error: `"${title}" needs at least ${need} answers.` };
    if ((kind === "this_or_that" || kind === "scale") && options.length > 2) return { error: `"${title}" can only have 2 answers.` };
    if (options.length > 40) return { error: `"${title}" has too many answers (40 at most).` };
    const max = kind === "choose_many" ? Math.max(1, Math.min(options.length, Math.round(q.max_pick || 3))) : 1;
    const min = kind === "choose_many" ? Math.max(1, Math.min(max, Math.round(q.min_pick || 1))) : 1;
    rows.push({
      ...(/^[0-9a-f-]{36}$/i.test(q.id) ? { id: q.id } : {}),
      pact_id: id,
      position: i,
      kind,
      title,
      subtitle: clean(q.subtitle, 90),
      options,
      min_pick: min,
      max_pick: max,
      weight: WEIGHTS.includes(q.weight) ? q.weight : "normal",
    });
  }
  const db = createAdminClient();
  const keep = rows.flatMap((r) => ("id" in r && r.id ? [r.id] : []));
  const { data: existing } = await db.from("pact_questions").select("id").eq("pact_id", id);
  const gone = (existing ?? []).map((r) => r.id as string).filter((x) => !keep.includes(x));
  if (gone.length) await db.from("pact_questions").delete().in("id", gone);
  const old = rows.filter((r) => "id" in r);
  const fresh = rows.filter((r) => !("id" in r));
  if (old.length) {
    const { error } = await db.from("pact_questions").upsert(old);
    if (error) return { error: "Couldn't save the questions. Please try again." };
  }
  if (fresh.length) {
    const { error } = await db.from("pact_questions").insert(fresh);
    if (error) return { error: "Couldn't save the questions. Please try again." };
  }
  revalidatePath(`/admin/pacts/${id}`);
  return {};
}

export async function setPactStatus(id: string, status: "draft" | "live"): Promise<{ error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: p } = await db.from("pacts").select("status").eq("id", id).single();
  if (p?.status === "revealed") return { error: "This pact has already been revealed." };
  if (status === "live") {
    const { count } = await db.from("pact_questions").select("id", { count: "exact", head: true }).eq("pact_id", id);
    if (!count) return { error: "Add questions before publishing." };
  }
  const { error } = await db.from("pacts").update({ status }).eq("id", id);
  if (error) return { error: "Couldn't change it. Please try again." };
  revalidatePath("/admin/pacts");
  revalidatePath(`/admin/pacts/${id}`);
  return {};
}

/** Reveal right now, instead of waiting for reveal night */
export async function revealPactNow(id: string): Promise<{ error?: string; summary?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const now = new Date().toISOString();
  // Reveal time becomes now (answers close too); the every-minute job finishes anything this run doesn't
  const { data: p } = await db.from("pacts").select("status, closes_at").eq("id", id).maybeSingle();
  if (!p || p.status !== "live") return { error: "This pact has already been revealed (or isn't published)." };
  await db.from("pacts").update({ reveal_at: now, ...(p.closes_at > now ? { closes_at: now } : {}) }).eq("id", id);
  const r = await runReveal(id, Date.now() + 40_000);
  revalidatePath(`/admin/pacts/${id}`);
  if (!r) return { summary: "Revealing now. Refresh in a minute to see progress." };
  if (r.step === "match" || r.step === "ready") return { summary: "Big pact: matching will finish within a few minutes, then it reveals." };
  return { summary: `${(r.pairs ?? 0).toLocaleString()} matches made from ${(r.people ?? 0).toLocaleString()} people.${r.step === "done" ? " Everyone has been told." : " Telling everyone now, this can take a few minutes."}` };
}

/** Runs the next part of matching or revealing right away (it also runs by itself every minute) */
export async function retryPactReveal(id: string): Promise<{ error?: string; summary?: string }> {
  await requireAdmin();
  const r = await runReveal(id, Date.now() + 40_000);
  revalidatePath(`/admin/pacts/${id}`);
  if (!r) return { summary: "It's already working on this pact. Refresh in a minute." };
  if (r.error) return { error: `Still not working: ${r.error}` };
  return { summary: r.step === "done" ? "Done. Everyone has been told." : "It's moving again. Refresh in a minute to see progress." };
}

/** Deletes a pact with its questions, answers and matches. The admin types the pact's name to confirm. */
export async function deletePact(id: string, typedName: string): Promise<{ error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: p } = await db.from("pacts").select("name").eq("id", id).maybeSingle();
  if (!p) return { error: "This pact was already deleted." };
  if (clean(typedName, 60).toLowerCase() !== clean(p.name, 60).toLowerCase()) return { error: "The name doesn't match. Type it exactly to delete." };
  // Answers and matches go with it; chats that already started stay open
  const { error } = await db.from("pacts").delete().eq("id", id);
  if (error) return { error: "Couldn't delete it. Please try again." };
  revalidatePath("/admin/pacts");
  return {};
}
