import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { eventEmail, sendEmailsEach } from "@/lib/email";
import { answersAsThings, emailKey, matchEveryone, pactPhase, type About, type Answers, type Entry, type Pact, type PactIntent, type PactQuestion, type PactView } from "@/lib/pacts";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site").replace(/\/$/, "");
const PACT_COLS = "id, slug, name, tagline, logo_url, header_url, accent, intents, areas, email_domain, closes_at, reveal_at, status, matched_at";
const Q_COLS = "id, position, kind, title, subtitle, options, min_pick, max_pick, weight";

/** A published pact with its questions and how many people have answered */
export async function loadPact(slug: string) {
  const db = createAdminClient();
  const { data } = await db.from("pacts").select(`${PACT_COLS}, entries_count`).eq("slug", slug).neq("status", "draft").maybeSingle();
  if (!data) return null;
  const { entries_count, ...pact } = data as Pact & { entries_count: number };
  const { data: questions } = await db.from("pact_questions").select(Q_COLS).eq("pact_id", pact.id).order("position");
  return { pact: pact as Pact, questions: (questions ?? []) as PactQuestion[], count: entries_count ?? 0 };
}

/** Live pacts for the Events page */
export async function livePacts() {
  const db = createAdminClient();
  const { data } = await db.from("pacts").select(`${PACT_COLS}, entries_count`).neq("status", "draft").gt("reveal_at", new Date(Date.now() - 3 * 86400_000).toISOString()).order("reveal_at");
  return ((data ?? []) as (Pact & { entries_count: number })[]).map(({ entries_count, ...p }) => ({ ...p, count: entries_count ?? 0 }));
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
    const { data } = await db.from("pact_entries").select("id, pact_id, user_id, answers").eq("email_key", emailKey(email));
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

type SubmitInput = {
  pact: Pact;
  questions: PactQuestion[];
  about: About;
  answers: Answers;
  email: string | null;
  userId: string | null;
  token: string | null;
  /** This phone's id (a cookie) */
  device: string | null;
};

const SAME_EMAIL = "Someone already took this pact with that email. If it was you, open the Pact on the phone you used, or log in to Dashpad with that email to change your answers.";
const SAME_PHONE = "This pact has already been taken on this phone. One entry per person keeps the matches real. Tap “Edit my answers” to change yours.";

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
  const key = email ? emailKey(email) : null;
  if (i.token && !i.userId) {
    // Editing from the phone that took it (it keeps the private link), maybe with a new email
    const { data: own } = await db.from("pact_entries").select("id, user_id").eq("pact_id", i.pact.id).eq("token", i.token).maybeSingle();
    if (own && !own.user_id) {
      const { error } = await db.from("pact_entries").update({ ...row, ...(key ? { email, email_key: key } : {}) }).eq("id", own.id);
      if (error) return { error: error.code === "23505" ? SAME_EMAIL : "We couldn't save your answers. Please try again." };
      return { token: i.token };
    }
  }
  if (key) {
    // The same inbox counts once, however it's written (dots and +tags in Gmail)
    const { data: same } = await db.from("pact_entries").select("id, token, user_id").eq("pact_id", i.pact.id).eq("email_key", key).maybeSingle();
    if (same) {
      // Only the person who took it (their phone has the token, or it's their account) can change it
      const theirs = (i.token && i.token === same.token) || (i.userId && same.user_id === i.userId) || (i.userId && !same.user_id);
      if (!theirs) return { error: SAME_EMAIL };
      await db.from("pact_entries").update({ ...row, ...(i.userId ? { user_id: i.userId } : {}) }).eq("id", same.id);
      if (i.userId) await addThings(i.userId, i.questions, i.answers);
      return { token: same.token as string };
    }
  }
  // A brand-new entry: one per phone
  if (i.device) {
    const { data: onPhone } = await db.from("pact_entries").select("id").eq("pact_id", i.pact.id).eq("device", i.device).maybeSingle();
    if (onPhone) return { error: SAME_PHONE };
  }
  const { data, error } = await db.from("pact_entries").insert({ ...row, email, email_key: key, user_id: i.userId, device: i.device }).select("token").single();
  if (error?.code === "23505") return { error: /device/.test(error.message) ? SAME_PHONE : SAME_EMAIL };
  if (error || !data) return { error: "We couldn't save your answers. Please try again." };
  if (i.userId) await addThings(i.userId, i.questions, i.answers);
  return { token: data.token as string };
}

/** Reveal night opened before the chats step reached this match: start its masked chat now */
async function startChat(matchId: number) {
  const { data } = await createAdminClient().rpc("create_pact_session", { p_match: matchId });
  return (data as string | null) ?? null;
}

/**
 * What someone sees on reveal night, from their private token (or their account). Nobody's
 * match shows by itself: it's a teaser until they tap to reveal, and revealing needs an account.
 */
export async function resultFor(pactId: string, by: { token?: string; userId?: string }): Promise<{ entryId: string; signedIn: boolean; view: PactView } | null> {
  const db = createAdminClient();
  let q = db.from("pact_entries").select("id, about, user_id, match_seen_at, lost_match_at").eq("pact_id", pactId);
  q = by.token ? q.eq("token", by.token) : q.eq("user_id", by.userId!);
  const { data: me } = await q.maybeSingle();
  if (!me) return null;
  const base = { entryId: me.id as string, signedIn: !!me.user_id };
  const { data: m } = await db.from("pact_matches").select("id, a, b, score, intent, alias_a, alias_b, shared, differ, session_id, rematch").or(`a.eq.${me.id},b.eq.${me.id}`).maybeSingle();
  if (!m) return { ...base, view: { kind: "none", lost: !!me.lost_match_at } };
  const shared = m.shared as { q: string; a: string }[];
  if (!me.user_id || !me.match_seen_at) {
    return { ...base, view: { kind: "teaser", score: m.score as number, intent: m.intent as PactIntent, inCommon: shared.length, rematch: !!m.rematch } };
  }
  const meIsA = m.a === me.id;
  const otherId = (meIsA ? m.b : m.a) as string;
  const { data: other } = await db.from("pact_entries").select("about, user_id").eq("id", otherId).single();
  const oa = (other?.about ?? {}) as About;
  const differ = m.differ as { q: string; a: string; b: string } | null;
  return {
    ...base,
    view: {
      kind: "match",
      match: {
        alias: (meIsA ? m.alias_b : m.alias_a) as string,
        score: m.score as number,
        intent: m.intent as PactIntent,
        age: oa.age,
        area: oa.area ?? null,
        work: m.intent === "business" ? oa.work ?? null : null,
        shared,
        differ: differ ? { q: differ.q, mine: meIsA ? differ.a : differ.b, theirs: meIsA ? differ.b : differ.a } : null,
        sessionId: (m.session_id as string | null) ?? (other?.user_id ? await startChat(m.id as number) : null),
        theyHaveAccount: !!other?.user_id,
        rematch: !!m.rematch,
      },
    },
  };
}

/** Someone with an account taps to reveal their match: remember it, and open the chat if their match has joined too */
export async function revealMyMatch(userId: string, pact: Pact) {
  if (pact.status !== "revealed") return { error: "Matches aren't out yet." };
  const db = createAdminClient();
  const { data: me } = await db.from("pact_entries").select("id").eq("pact_id", pact.id).eq("user_id", userId).maybeSingle();
  if (!me) return { error: "You didn't take this pact." };
  await db.from("pact_entries").update({ match_seen_at: new Date().toISOString() }).eq("id", me.id).is("match_seen_at", null);
  const { data: m } = await db.from("pact_matches").select("id, session_id").or(`a.eq.${me.id},b.eq.${me.id}`).maybeSingle();
  if (m && !m.session_id) await startChat(m.id as number);
  return { ok: true };
}

const ALIAS_A = ["Velvet", "Quiet", "Golden", "Midnight", "Silver", "Crimson", "Lucky", "Gentle", "Bold", "Secret", "Starry", "Wild", "Calm", "Bright", "Misty", "Royal"];
const ALIAS_B = ["Heron", "Moth", "Fox", "Owl", "Lynx", "Falcon", "Panther", "Dove", "Tiger", "Swan", "Raven", "Wolf", "Hare", "Ibis", "Kestrel", "Gazelle"];
const alias = () => `${ALIAS_A[Math.floor(Math.random() * ALIAS_A.length)]} ${ALIAS_B[Math.floor(Math.random() * ALIAS_B.length)]}`;

type RevealStep = "match" | "ready" | "chats" | "notify" | "done";
type RevealRow = Pact & { reveal_step: RevealStep; reveal_cursor: string | null; reveal_stats: Record<string, number> };
export type RevealProgress = { step: RevealStep; people?: number; pairs?: number; told?: number; emailed?: number; waiting?: boolean; error?: string };

/**
 * A pact's matching and reveal, in steps that pick up where they stopped, so a pact with
 * 100,000 people never gets stuck halfway:
 *   1. match: once answers close, everyone is matched and the matches are saved (hidden).
 *      There are up to 12 hours before reveal night, so this can take as many runs as it needs.
 *   2. ready: waiting for reveal time. Then the pact shows as revealed.
 *   3. chats: masked chats start for matches where both people have accounts
 *   4. notify: a notification for people with accounts, an email for everyone else
 * Each run works until `deadline` (a time in ms) and saves its place. Only one run works
 * on a pact at a time. The every-minute job keeps calling until the pact is done.
 */
export async function runReveal(pactId: string, deadline: number): Promise<RevealProgress | null> {
  const db = createAdminClient();
  const { data: got } = await db.rpc("claim_pact_reveal", { p_pact: pactId, p_seconds: Math.ceil((deadline - Date.now()) / 1000) + 20 });
  const pact = (Array.isArray(got) ? got[0] : got) as RevealRow | undefined;
  if (!pact) return null;
  const left = () => deadline - Date.now();
  const save = (patch: Record<string, unknown>) => db.from("pacts").update(patch).eq("id", pactId);
  let step = pact.reveal_step;
  let cursor = pact.reveal_cursor;
  const stats: Record<string, number | string> & { people?: number; pairs?: number; told?: number; emailed?: number } = { ...pact.reveal_stats };
  try {
    if (step === "match") {
      const done = await matchStep(pact, left);
      if (!done) return { step, waiting: true };
      Object.assign(stats, done);
      step = "ready";
      cursor = null;
      await save({ reveal_step: step, reveal_cursor: null, reveal_stats: stats });
    }
    if (step === "ready") {
      // Matches stay hidden until reveal time
      if (Date.now() < new Date(pact.reveal_at).getTime()) return { step, people: stats.people, pairs: stats.pairs };
      step = "chats";
      await save({ status: "revealed", matched_at: new Date().toISOString(), reveal_step: step, reveal_cursor: null });
    }
    if (step === "chats") {
      let after = Number(cursor ?? 0);
      while (left() > 4000) {
        const { data, error } = await db.rpc("create_pact_sessions", { p_pact: pactId, p_after: after, p_limit: 300 });
        if (error) throw error;
        const r = data as { done: number; last: number };
        after = r.last;
        await save({ reveal_cursor: String(after) });
        if (r.done < 300) {
          step = "notify";
          cursor = null;
          await save({ reveal_step: step, reveal_cursor: null });
          break;
        }
      }
    }
    if (step === "notify") {
      while (left() > 8000) {
        const { data, error } = await db.rpc("pact_notify_page", { p_pact: pactId, p_after: cursor, p_limit: 1000 });
        if (error) throw error;
        const page = (data ?? []) as { id: string; user_id: string | null; email: string | null; token: string; matched: boolean }[];
        if (!page.length) {
          step = "done";
          await save({ reveal_step: step, reveal_cursor: null, reveal_stats: stats });
          break;
        }
        const told = await tellPage(pact, page);
        stats.told = (stats.told ?? 0) + told.pushed;
        stats.emailed = (stats.emailed ?? 0) + told.emailed;
        cursor = page[page.length - 1].id;
        await save({ reveal_cursor: cursor, reveal_stats: stats });
      }
    }
    // Got through without a problem: clear any earlier one
    if (stats.error) {
      delete stats.error;
      delete stats.failed_at;
      await save({ reveal_stats: stats });
    }
    return { step, people: stats.people, pairs: stats.pairs, told: stats.told, emailed: stats.emailed };
  } catch (e) {
    // Saved for the admin page. Nothing is lost: the next run (every minute) carries on from the last saved place.
    const error = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    console.error(`pact ${pactId} reveal step ${step} failed`, e);
    await save({ reveal_stats: { ...stats, error: error.slice(0, 300), failed_at: new Date().toISOString() } });
    return { step, error };
  } finally {
    await save({ reveal_lock: null });
  }
}

/** Everyone in the pact, in the same order every time, loaded 1,000 at a time (10 pages at once) */
async function loadEntries(pactId: string) {
  const db = createAdminClient();
  const { count } = await db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", pactId);
  const pages = Math.ceil((count ?? 0) / 1000);
  const out: Entry[] = [];
  for (let p = 0; p < pages; p += 10) {
    const got = await Promise.all(
      Array.from({ length: Math.min(10, pages - p) }, (_, k) =>
        db.from("pact_entries").select("id, about, answers").eq("pact_id", pactId).order("id").range((p + k) * 1000, (p + k) * 1000 + 999),
      ),
    );
    for (const g of got) {
      if (g.error) throw g.error;
      out.push(...((g.data ?? []) as Entry[]));
    }
  }
  return out;
}

/**
 * Step 1: match everyone and save the matches. Returns null if there isn't enough time left
 * in this run (the next run starts it again; matching gives the same pairs every time, and
 * matches already saved are skipped).
 */
async function matchStep(pact: Pact, left: () => number): Promise<{ people: number; pairs: number } | null> {
  const db = createAdminClient();
  const { count } = await db.from("pact_entries").select("id", { count: "exact", head: true }).eq("pact_id", pact.id);
  // About 15 seconds per 100,000 people to load and match, more to save: wait for a run with enough time
  const need = 6000 + (count ?? 0) * 0.3;
  if (left() < need) return null;
  const [{ data: qs }, entries] = await Promise.all([db.from("pact_questions").select(Q_COLS).eq("pact_id", pact.id).order("position"), loadEntries(pact.id)]);
  const pairs = matchEveryone((qs ?? []) as PactQuestion[], entries);

  // Matches a stopped run already saved
  const saved = new Set<string>();
  const { count: have } = await db.from("pact_matches").select("id", { count: "exact", head: true }).eq("pact_id", pact.id);
  for (let from = 0; from < (have ?? 0); from += 1000) {
    const { data } = await db.from("pact_matches").select("a").eq("pact_id", pact.id).order("id").range(from, from + 999);
    (data ?? []).forEach((m) => saved.add(m.a as string));
  }
  const rows = pairs
    .filter((p) => !saved.has(p.a))
    .map((p) => {
      const a = alias();
      let b = alias();
      while (b === a) b = alias();
      return { pact_id: pact.id, a: p.a, b: p.b, score: p.score, intent: p.intent, shared: p.shared, differ: p.differ, alias_a: a, alias_b: b };
    });
  for (let i = 0; i < rows.length; i += 4000) {
    if (left() < 3000) return null;
    const res = await Promise.all([0, 1000, 2000, 3000].filter((k) => i + k < rows.length).map((k) => db.from("pact_matches").insert(rows.slice(i + k, i + k + 1000))));
    const bad = res.find((r) => r.error);
    if (bad) throw bad.error;
  }
  return { people: entries.length, pairs: pairs.length };
}

/** Step 3, for one page of people: notifications for people with accounts, emails for everyone else */
async function tellPage(pact: Pact, page: { user_id: string | null; email: string | null; token: string; matched: boolean }[]) {
  const withMatch = page.filter((e) => e.user_id && e.matched).map((e) => e.user_id!);
  const without = page.filter((e) => e.user_id && !e.matched).map((e) => e.user_id!);
  const [a, b] = await Promise.all([
    pushToUsers(withMatch, { title: `${pact.name}: you have a match ⭐`, body: "Out of everyone in the Pact, you two fit best. Tap to reveal who it is.", url: `/pact/${pact.slug}`, tag: `pact-${pact.id}` }),
    pushToUsers(without, { title: `${pact.name} has been revealed`, body: "No match for you this time. Meet new people on Dashpad every hour.", url: `/pact/${pact.slug}`, tag: `pact-${pact.id}` }),
  ]);
  const mails = page
    .filter((e) => !e.user_id && e.email)
    .map((e) => {
      const link = `${site()}/pact/${pact.slug}/match?t=${e.token}`;
      const m = eventEmail({
        heading: e.matched ? "You have a match" : "The Pact has been revealed",
        message: e.matched
          ? `Out of everyone who took ${pact.name}, you two fit best. Join Dashpad (it's free) to reveal who it is and start chatting, masked.`
          : `We couldn't find you a match this time, but there are people like you on Dashpad for business, friendship, love or something spicy.`,
        title: pact.name,
        when: "Reveal night",
        kind: "Pact",
        link,
        button: e.matched ? "Reveal my match" : "Open Dashpad",
        footer: "You're getting this because you took this pact.",
      });
      return { to: e.email!, subject: e.matched ? `${pact.name}: you have a match` : `${pact.name} has been revealed`, ...m };
    });
  const mail = await sendEmailsEach(mails);
  return { pushed: a.sent + b.sent, emailed: mail.sent };
}

/** For the every-minute job: matches pacts whose answers have closed, and reveals them at reveal time, until the deadline */
export async function revealDuePacts(deadline: number) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("pacts")
    .select("id")
    .neq("status", "draft")
    .lte("closes_at", now)
    .or(`reveal_step.is.null,reveal_step.in.(match,chats,notify),and(reveal_step.eq.ready,reveal_at.lte."${now}")`)
    .order("reveal_at")
    .limit(5);
  const out: (RevealProgress & { id: string; rematched?: number })[] = [];
  for (const p of data ?? []) {
    if (deadline - Date.now() < 5000) break;
    // One pact with a problem never holds up the others
    const r = await runReveal(p.id as string, deadline).catch((e) => ({ step: "match" as const, error: String(e) }));
    if (r) out.push({ id: p.id as string, ...r });
  }
  // From 48 hours after reveal night (for two weeks, every 6 hours): rematch people whose match never joined
  if (deadline - Date.now() > 15_000) {
    const { data: due } = await db
      .from("pacts")
      .select(PACT_COLS)
      .eq("status", "revealed")
      .eq("reveal_step", "done")
      .lte("reveal_at", new Date(Date.now() - 48 * 3600_000).toISOString())
      .gte("reveal_at", new Date(Date.now() - 14 * 86400_000).toISOString())
      .or(`rematched_at.is.null,rematched_at.lt."${new Date(Date.now() - 6 * 3600_000).toISOString()}"`)
      .limit(3);
    for (const p of (due ?? []) as Pact[]) {
      if (deadline - Date.now() < 15_000) break;
      const n = await rematchPact(p).catch((e) => (console.error(`pact ${p.id} rematch failed`, e), 0));
      out.push({ id: p.id, step: "done", rematched: n });
    }
  }
  return out;
}

/** Ids in small groups, so requests stay short */
const chunks = <T,>(list: T[], size = 100) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * 48 hours after reveal night: people who joined Dashpad but whose match didn't (or who had no
 * match) are matched again among themselves. The person who never joined loses that match.
 */
async function rematchPact(pact: Pact) {
  const db = createAdminClient();
  await db.from("pacts").update({ rematched_at: new Date().toISOString() }).eq("id", pact.id);
  const { data } = await db.rpc("pact_stranded", { p_pact: pact.id });
  const stranded = (data ?? []) as (Entry & { match_id: number | null })[];
  if (stranded.length < 2) return 0;
  const { data: qs } = await db.from("pact_questions").select(Q_COLS).eq("pact_id", pact.id).order("position");
  const pairs = matchEveryone((qs ?? []) as PactQuestion[], stranded);
  if (!pairs.length) return 0;
  const moving = new Set(pairs.flatMap((p) => [p.a, p.b]));

  // Their old matches go; the partners who never joined are told on their page if they come back
  const oldIds = stranded.filter((e) => moving.has(e.id) && e.match_id).map((e) => e.match_id!);
  for (const ids of chunks(oldIds)) {
    const { data: old } = await db.from("pact_matches").select("a, b").in("id", ids);
    const partners = (old ?? []).map((m) => (moving.has(m.a as string) ? m.b : m.a) as string).filter((id) => !moving.has(id));
    if (partners.length) await db.from("pact_entries").update({ lost_match_at: new Date().toISOString() }).in("id", partners);
    await db.from("pact_matches").delete().in("id", ids);
  }
  const { data: last } = await db.from("pact_matches").select("id").eq("pact_id", pact.id).order("id", { ascending: false }).limit(1).maybeSingle();
  const rows = pairs.map((p) => {
    const a = alias();
    let b = alias();
    while (b === a) b = alias();
    return { pact_id: pact.id, a: p.a, b: p.b, score: p.score, intent: p.intent, shared: p.shared, differ: p.differ, alias_a: a, alias_b: b, rematch: true };
  });
  for (const part of chunks(rows, 1000)) {
    const { error } = await db.from("pact_matches").insert(part);
    if (error) throw error;
  }
  // A new match to reveal, with its masked chat ready (both have accounts)
  const users: string[] = [];
  for (const ids of chunks([...moving])) {
    await db.from("pact_entries").update({ match_seen_at: null }).in("id", ids);
    const { data: es } = await db.from("pact_entries").select("user_id").in("id", ids);
    (es ?? []).forEach((e) => e.user_id && users.push(e.user_id as string));
  }
  let after = Number(last?.id ?? 0);
  for (;;) {
    const { data: r } = await db.rpc("create_pact_sessions", { p_pact: pact.id, p_after: after, p_limit: 300 });
    const got = r as { done: number; last: number } | null;
    if (!got || got.done < 300) break;
    after = got.last;
  }
  await pushToUsers(users, { title: `${pact.name}: you have a new match ⭐`, body: "Your first match didn't join, so we found you someone new. Tap to reveal them.", url: `/pact/${pact.slug}`, tag: `pact-${pact.id}` });
  return pairs.length;
}

/** Emails someone their private result link again */
export async function resendLink(pact: Pact, email: string) {
  const db = createAdminClient();
  const { data: e } = await db.from("pact_entries").select("token, email").eq("pact_id", pact.id).eq("email_key", emailKey(email)).maybeSingle();
  if (!e?.email) return;
  const link = `${site()}/pact/${pact.slug}/match?t=${e.token}`;
  const m = eventEmail({ heading: "Your Pact link", message: "Here's your private link. Keep it safe: it shows your match on reveal night.", title: pact.name, when: "Reveal night", kind: "Pact", link, button: "Open my Pact", footer: "You're getting this because you asked for your pact link." });
  await sendEmailsEach([{ to: e.email as string, subject: `Your link for ${pact.name}`, ...m }]);
}
