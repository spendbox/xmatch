import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

/** An error from someone's phone: saved so it can be fixed (Admin → App errors) */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: unknown; stack?: unknown; url?: unknown } | null;
  const message = cut(body?.message, 500);
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });
  const { user } = await getAuth().catch(() => ({ user: null }));
  await createAdminClient()
    .from("client_errors")
    .insert({ user_id: user?.id ?? null, message, stack: cut(body?.stack, 4000), url: cut(body?.url, 300), agent: cut(req.headers.get("user-agent"), 300) })
    .then(
      () => null,
      () => null,
    );
  return NextResponse.json({ ok: true });
}
