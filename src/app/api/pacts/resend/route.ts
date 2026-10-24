import { NextResponse } from "next/server";
import { verifyHuman } from "@/lib/turnstile";
import { loadPact, resendLink } from "@/lib/pactsServer";

// "Send my link again": emails someone their private pact link (says the same thing either way)
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: string; email?: string; human?: string } | null;
  if (!body?.slug || !body.email) return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  if (!(await verifyHuman(body.human ?? null))) return NextResponse.json({ error: "Please confirm you're human and try again." }, { status: 400 });
  const loaded = await loadPact(body.slug);
  if (loaded) await resendLink(loaded.pact, body.email.slice(0, 200));
  return NextResponse.json({ ok: true });
}
