import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { claimEntries } from "@/lib/pactsServer";

// After someone joins Dashpad: attach the pacts they took (on this phone, or with this email) to their account
export async function POST(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { tokens?: unknown } | null;
  const tokens = Array.isArray(body?.tokens) ? body.tokens.filter((t): t is string => typeof t === "string") : [];
  const claimed = await claimEntries(user.id, user.email, tokens);
  return NextResponse.json({ claimed });
}
