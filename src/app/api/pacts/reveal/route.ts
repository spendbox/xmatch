import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { loadPact, revealMyMatch } from "@/lib/pactsServer";

// "Reveal my match" on reveal night (needs a Dashpad account)
export async function POST(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Join Dashpad to reveal your match." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { slug?: string } | null;
  const loaded = body?.slug ? await loadPact(body.slug) : null;
  if (!loaded) return NextResponse.json({ error: "This Link-Up doesn't exist." }, { status: 404 });
  const r = await revealMyMatch(user.id, loaded.pact);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
