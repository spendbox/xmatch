import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { r2Enabled, uploadLink } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** An upload link for a masked voice note (already disguised on the phone), straight to R2 */
export async function POST(req: Request) {
  if (!r2Enabled()) return NextResponse.json({ error: "Voice notes aren't switched on yet." }, { status: 404 });
  const { supabase, user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { sessionId } = ((await req.json().catch(() => ({}))) ?? {}) as { sessionId?: string };
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  // Only someone in this chat, while it's still going
  const { data: ok } = await supabase.rpc("can_post_masked", { p_session: sessionId });
  if (ok !== true) return NextResponse.json({ error: "This chat has ended." }, { status: 403 });
  const key = `voice/${sessionId}/${randomUUID()}.wav`;
  return NextResponse.json({ key, upload: await uploadLink(key) });
}
