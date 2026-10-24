import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { verifyHuman } from "@/lib/turnstile";
import { cleanAbout, cleanAnswers } from "@/lib/pacts";
import { loadPact, saveEntry } from "@/lib/pactsServer";

// Someone finished a pact: save their answers (no account needed)
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: string; about?: unknown; answers?: unknown; email?: string; token?: string; human?: string } | null;
  if (!body?.slug) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  const loaded = await loadPact(body.slug);
  if (!loaded) return NextResponse.json({ error: "This pact doesn't exist." }, { status: 404 });
  const { pact, questions } = loaded;
  const { user } = await getAuth();
  if (!user && !(await verifyHuman(body.human ?? null))) return NextResponse.json({ error: "Please confirm you're human and try again." }, { status: 400 });

  const answers = cleanAnswers(questions, body.answers);
  if (typeof answers === "string") return NextResponse.json({ error: answers }, { status: 400 });
  const about = cleanAbout(pact, body.about);
  if (typeof about === "string") return NextResponse.json({ error: about }, { status: 400 });

  let email = user?.email ?? (typeof body.email === "string" ? body.email.trim().toLowerCase() : "");
  if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Enter your email so we can send you your match." }, { status: 400 });
  if (pact.email_domain) {
    // School and company pacts: only for verified accounts with that email
    const domain = pact.email_domain.replace(/^@/, "").toLowerCase();
    if (!user) return NextResponse.json({ error: `Log in with your ${domain} email to take this pact.`, login: true }, { status: 400 });
    if (!(user.email ?? "").toLowerCase().endsWith("@" + domain)) return NextResponse.json({ error: `This pact is only for ${domain} emails.` }, { status: 400 });
  }
  email = email.slice(0, 200);
  const saved = await saveEntry({ pact, questions, about, answers, email: email || null, userId: user?.id ?? null, token: typeof body.token === "string" ? body.token : null });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
  return NextResponse.json({ token: saved.token });
}
