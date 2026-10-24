import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "@/lib/auth";
import { cleanAbout, cleanAnswers, isThrowaway } from "@/lib/pacts";
import { loadPact, saveEntry } from "@/lib/pactsServer";

const DEVICE = "dp_dev";

// Someone finished a pact: save their answers to their Dashpad account (an account is needed,
// so nobody can take the pact as someone else). One entry per account and per phone.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: string; about?: unknown; answers?: unknown; email?: string } | null;
  if (!body?.slug) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  const loaded = await loadPact(body.slug);
  if (!loaded) return NextResponse.json({ error: "This Twin doesn't exist." }, { status: 404 });
  const { pact, questions } = loaded;
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Create a free Dashpad account to join Twin.", signup: true }, { status: 401 });

  const answers = cleanAnswers(questions, body.answers);
  if (typeof answers === "string") return NextResponse.json({ error: answers }, { status: 400 });
  const about = cleanAbout(pact, body.about);
  if (typeof about === "string") return NextResponse.json({ error: about }, { status: 400 });

  // School and company pacts: their school email (confirmed with a link before matching). Everyone else: the account's email.
  let email = (user.email ?? "").toLowerCase();
  if (pact.email_domain) {
    const domain = pact.email_domain.replace(/^@/, "").toLowerCase();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email.endsWith("@" + domain) || !/^[^\s@]+@[^\s@]+$/.test(email)) return NextResponse.json({ error: `Enter your ${domain} email. This Twin is only for ${domain} emails.` }, { status: 400 });
    if (isThrowaway(email)) return NextResponse.json({ error: `Enter your ${domain} email.` }, { status: 400 });
  }
  email = email.slice(0, 200);
  // This phone's id lives in a cookie for two years
  const jar = await cookies();
  const known = jar.get(DEVICE)?.value;
  const device = known && /^[0-9a-f-]{36}$/.test(known) ? known : randomUUID();

  const saved = await saveEntry({ pact, questions, about, answers, email: email || null, userId: user.id, token: null, device });
  const res = NextResponse.json("error" in saved ? { error: saved.error } : { token: saved.token, confirm: !!saved.confirm }, { status: "error" in saved ? 400 : 200 });
  if (device !== known) res.cookies.set(DEVICE, device, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 730 });
  return res;
}
