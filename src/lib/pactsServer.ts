import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { eventEmail, sendEmailsEach } from "@/lib/email";
import { answersAsThings, intentLabel, matchEveryone, pactPhase, type About, type Answers, type Entry, type Pact, type PactQuestion } from "@/lib/pacts";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site").replace(/\/$/, "");
const PACT_COLS = "id, slug, name, tagline, logo_url, header_url, accent, intents, areas, email_domain, closes_at, reveal_at, status, matched_at";
const Q_COLS = "id, position, kind, title, subtitle, options, min_pick, max_pick, weight";

/** A published pact with its questions and how many people have answered */
export async function loadPact(slug: string) {
  const db = createAdminClient();
  const { data: pact } = await db.from("pacts").select(PACT_COLS).eq("slug", slug).neq("status", "draft").maybeSingle();
  if (!pact) return null;
  const [{ data: questions }, { count }] = await Promise.all([
    db.from("pact_questions").select(Q_COLS).eq("pact_id", pact.id).order("position"),
    db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", pact.id),
  ]);
  return { pact: pact as Pact, questions: (questions ?? []) as PactQuestion[], count: count ?? 0 };
}

/** Live pacts for the Events page */
export async function livePacts() {
  const db = createAdminClient();
  const { data } = await db.from("pacts").select(PACT_COLS).neq("status", "draft").gt("reveal_at", new Date(Date.now() - 3 * 86400_000).toISOString()).order("reveal_at");
  const pacts = (data ?? []) as Pact[];
  const counts = await Promise.all(pacts.map((p) => db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", p.id)));
  return pacts.map((p, i) => ({ ...p, count: counts[i].count ?? 0 }));
}

/** Adds someone's pact answers to their "things about you" (no repeats, 40 at most) */
async function addThings(userId: string, questions: PactQuestion[], answers: Answers) {
  const db = createAdminClient();
  const { data: prof } = await db.from("profiles").select("things").eq("id", userId).maybeSingle();
  const things = ((prof?.things ?? []) as { p: string; a: string }[]).slice();
  const have = new Set(things.map((t) => t.a.toLowerCase()));
  for (const line of answersAsThings(questions, answers)) {
    if (things.length >= 40) break;
    // Replace an older answer to the same question ("Money: …")
    const head = line.split(":")[0].toLowerCase() + ":";
    const at = things.findIndex((t) => t.p === "else" && t.a.toLowerCase().startsWith(head));
    if (at >= 0) things[at] = { p: "else", a: line };
    else if (!have.has(line.toLowerCase())) things.push({ p: "else", a: line });
  }
  await db.from("profiles").update({ things }).eq("id", userId);
}

/**
 * Attaches pact answers to a Dashpad account: the ones taken on this phone (their private
 * tokens) and the ones taken with the account's email. Starts any matches' masked chats.
 */
export async function claimEntries(userId: string, email: string | null, tokens: string[] = []) {
  const db = createAdminClient();
  const found = new Map<string, { id: string; pact_id: string; user_id: string | null; answers: Answers }>();
  const cleanTokens = tokens.filter((t) => /^[0-9a-f]{64}$/.test(t)).slice(0, 20);
  if (cleanTokens.length) {
    const { data } = await db.from("pact_entries").select("id, pact_id, user_id, answers").in("token", cleanTokens);
    (data ?? []).forEach((e) => found.set(e.id as string, e as never));
  }
  if (email) {
    const { data } = await db.from("pact_entries").select("id, pact_id, user_id, answers").ilike("email", email);
    (data ?? []).forEach((e) => found.set(e.id as string, e as never));
  }
  let claimed = 0;
  for (const e of found.values()) {
    if (e.user_id && e.user_id !== userId) continue;
    if (!e.user_id) {
      // One entry per pact per person: keep the one already on the account
      const { data: mine } = await db.from("pact_entries").select("id").eq("pact_id", e.pact_id).eq("user_id", userId).maybeSingle();
      if (mine && mine.id !== e.id) continue;
      const { error } = await db.from("pact_entries").update({ user_id: userId }).eq("id", e.id).is("user_id", null);
      if (error) continue;
      claimed++;
      const { data: qs } = await db.from("pact_questions").select(Q_COLS).eq("pact_id", e.pact_id);
      await addThings(userId, (qs ?? []) as PactQuestion[], e.answers);
    }
    const { data: m } = await db.from("pact_matches").select("id, session_id").or(`a.eq.${e.id},b.eq.${e.id}`).maybeSingle();
    if (m && !m.session_id) await db.rpc("create_pact_session", { p_match: m.id });
  }
  return claimed;
}

type SubmitInput = { pact: Pact; questions: PactQuestion[]; about: About; answers: Answers; email: string | null; userId: string | null; token: string | null };

/** Saves someone's answers. Returns their private token, or a message saying what went wrong. */
export async function saveEntry(i: SubmitInput): Promise<{ token: string } | { error: string }> {
  const db = createAdminClient();
  if (pactPhase(i.pact) !== "open") return { error: "This pact has closed. Reveal night is coming." };
  const row = { pact_id: i.pact.id, about: i.about, answers: i.answers, updated_at: new Date().toISOString() };
  if (i.userId) {
    const { data: mine } = await db.from("pact_entries").select("id, token").eq("pact_id", i.pact.id).eq("user_id", i.userId).maybeSingle();
    if (mine) {
      await db.from("pact_entries").update(row).eq("id", mine.id);
      await addThings(i.userId, i.questions, i.answers);
      return { token: mine.token as string };
    }
  }
  const email = i.email?.trim().toLowerCase() || null;
  if (email) {
    const { data: same } = await db.from("pact_entries").select("id, token, user_id").eq("pact_id", i.pact.id).ilike("email", email).maybeSingle();
    if (same) {
      // Only the person who took it (their phone has the token, or it's their account) can change it
      const theirs = (i.token && i.token === same.token) || (i.userId && same.user_id === i.userId) || (i.userId && !same.user_id);
      if (!theirs) return { error: "Someone already took this pact with that email. If it was you, open the link we sent you." };
      await db.from("pact_entries").update({ ...row, ...(i.userId ? { user_id: i.userId } : {}) }).eq("id", same.id);
      if (i.userId) await addThings(i.userId, i.questions, i.answers);
      return { token: same.token as string };
    }
  }
  const { data, error } = await db.from("pact_entries").insert({ ...row, email, user_id: i.userId }).select("token").single();
  if (error || !data) return { error: "We couldn't save your answers. Please try again." };
  if (i.userId) await addThings(i.userId, i.questions, i.answers);
  return { token: data.token as string };
}

/** What someone sees on reveal night, from their private token (or their account) */
export async function resultFor(pactId: string, by: { token?: string; userId?: string }) {
  const db = createAdminClient();
  let q = db.from("pact_entries").select("id, about, user_id").eq("pact_id", pactId);
  q = by.token ? q.eq("token", by.token) : q.eq("user_id", by.userId!);
  const { data: me } = await q.maybeSingle();
  if (!me) return null;
  const { data: m } = await db.from("pact_matches").select("id, a, b, score, intent, alias_a, alias_b, shared, differ, session_id").or(`a.eq.${me.id},b.eq.${me.id}`).maybeSingle();
  if (!m) return { entryId: me.id as string, signedIn: !!me.user_id, match: null };
  const meIsA = m.a === me.id;
  const otherId = (meIsA ? m.b : m.a) as string;
  const { data: other } = await db.from("pact_entries").select("about, user_id").eq("id", otherId).single();
  const oa = (other?.about ?? {}) as About;
  const differ = m.differ as { q: string; a: string; b: string } | null;
  return {
    entryId: me.id as string,
    signedIn: !!me.user_id,
    match: {
      alias: (meIsA ? m.alias_b : m.alias_a) as string,
      myAlias: (meIsA ? m.alias_a : m.alias_b) as string,
      score: m.score as number,
      intent: m.intent as Entry["about"]["intents"][number],
      age: oa.age,
      area: oa.area ?? null,
      work: m.intent === "business" ? oa.work ?? null : null,
      shared: m.shared as { q: string; a: string }[],
      differ: differ ? { q: differ.q, mine: meIsA ? differ.a : differ.b, theirs: meIsA ? differ.b : differ.a } : null,
      sessionId: (m.session_id as string | null) ?? null,
      theyHaveAccount: !!other?.user_id,
    },
  };
}

const ALIAS_A = ["Velvet", "Quiet", "Golden", "Midnight", "Silver", "Crimson", "Lucky", "Gentle", "Bold", "Secret", "Starry", "Wild", "Calm", "Bright", "Misty", "Royal"];
const ALIAS_B = ["Heron", "Moth", "Fox", "Owl", "Lynx", "Falcon", "Panther", "Dove", "Tiger", "Swan", "Raven", "Wolf", "Hare", "Ibis", "Kestrel", "Gazelle"];
const alias = () => `${ALIAS_A[Math.floor(Math.random() * ALIAS_A.length)]} ${ALIAS_B[Math.floor(Math.random() * ALIAS_B.length)]}`;

/**
 * Reveal night: matches everyone in a pact (once), starts masked chats for people with
 * accounts, and tells everyone. Safe to call again: only the first call does the work.
 */
export async function revealPact(pactId: string, force = false) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  // Claim the job: only one call gets past this
  let claim = db.from("pacts").update({ status: "revealed", matched_at: now }).eq("id", pactId).is("matched_at", null).neq("status", "draft");
  if (!force) claim = claim.lte("reveal_at", now);
  const { data: got } = await claim.select(PACT_COLS).maybeSingle();
  if (!got) return { done: false as const };
  const pact = got as Pact;

  const { data: qs } = await db.from("pact_questions").select(Q_COLS).eq("pact_id", pactId).order("position");
  const questions = (qs ?? []) as PactQuestion[];
  const entries: (Entry & { user_id: string | null; email: string | null; token: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("pact_entries").select("id, about, answers, user_id, email, token").eq("pact_id", pactId).range(from, from + 999);
    if (!data?.length) break;
    entries.push(...(data as never[]));
    if (data.length < 1000) break;
  }
  const pairs = matchEveryone(questions, entries);
  const rows = pairs.map((p) => {
    const a = alias();
    let b = alias();
    while (b === a) b = alias();
    return { pact_id: pactId, a: p.a, b: p.b, score: p.score, intent: p.intent, shared: p.shared, differ: p.differ, alias_a: a, alias_b: b };
  });
  for (let i = 0; i < rows.length; i += 500) await db.from("pact_matches").insert(rows.slice(i, i + 500));

  // Masked chats for pairs who both have accounts
  const { data: saved } = await db.from("pact_matches").select("id, a, b").eq("pact_id", pactId);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const both = (saved ?? []).filter((m) => byId.get(m.a as string)?.user_id && byId.get(m.b as string)?.user_id);
  for (let i = 0; i < both.length; i += 10) await Promise.all(both.slice(i, i + 10).map((m) => db.rpc("create_pact_session", { p_match: m.id })));

  // Tell everyone: a notification for people with accounts, an email for everyone else
  const matched = new Set(pairs.flatMap((p) => [p.a, p.b]));
  const users = entries.filter((e) => e.user_id);
  const withMatch = users.filter((e) => matched.has(e.id)).map((e) => e.user_id!);
  const without = users.filter((e) => !matched.has(e.id)).map((e) => e.user_id!);
  await pushToUsers(withMatch, { title: `${pact.name}: your match is here`, body: "Out of everyone in the Pact, you two fit best. Say hi, masked.", url: `/pact/${pact.slug}`, tag: `pact-${pact.id}` });
  await pushToUsers(without, { title: `${pact.name} has been revealed`, body: "No match for you this time. Meet new people on Dashpad every hour.", url: `/pact/${pact.slug}`, tag: `pact-${pact.id}` });
  const mails = entries
    .filter((e) => !e.user_id && e.email)
    .map((e) => {
      const link = `${site()}/pact/${pact.slug}/match?t=${e.token}`;
      const ok = matched.has(e.id);
      const m = eventEmail({
        heading: ok ? "Your Pact match is here" : "The Pact has been revealed",
        message: ok
          ? `Out of everyone who took ${pact.name}, you two fit best. See who it is and what you have in common.`
          : `We couldn't find you a match this time, but there are people like you on Dashpad for business, friendship, love or something spicy.`,
        title: pact.name,
        when: "Reveal night",
        kind: "Pact",
        link,
        button: ok ? "See my match" : "Open Dashpad",
        footer: "You're getting this because you took this pact.",
      });
      return { to: e.email!, subject: ok ? `${pact.name}: your match is here` : `${pact.name} has been revealed`, ...m };
    });
  const mail = await sendEmailsEach(mails);
  return { done: true as const, people: entries.length, pairs: pairs.length, emailed: mail.sent, intents: pairs.reduce<Record<string, number>>((o, p) => ((o[intentLabel(p.intent)] = (o[intentLabel(p.intent)] ?? 0) + 1), o), {}) };
}

/** For the 5-minute job: reveals every pact whose reveal time has come */
export async function revealDuePacts() {
  const db = createAdminClient();
  const { data } = await db.from("pacts").select("id").eq("status", "live").is("matched_at", null).lte("reveal_at", new Date().toISOString());
  const out = [];
  for (const p of data ?? []) out.push(await revealPact(p.id as string));
  return out;
}

/** Emails someone their private result link again */
export async function resendLink(pact: Pact, email: string) {
  const db = createAdminClient();
  const { data: e } = await db.from("pact_entries").select("token").eq("pact_id", pact.id).ilike("email", email.trim()).maybeSingle();
  if (!e) return;
  const link = `${site()}/pact/${pact.slug}/match?t=${e.token}`;
  const m = eventEmail({ heading: "Your Pact link", message: "Here's your private link. Keep it safe: it shows your match on reveal night.", title: pact.name, when: "Reveal night", kind: "Pact", link, button: "Open my Pact", footer: "You're getting this because you asked for your pact link." });
  await sendEmailsEach([{ to: email.trim(), subject: `Your link for ${pact.name}`, ...m }]);
}
