import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pagePath, type SpeedSample } from "@/lib/speedLog";

export const dynamic = "force-dynamic";

const KINDS = new Set(["page", "browser"]);

/** Timings from someone's phone, for Admin → Speed */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { samples?: SpeedSample[] } | null;
  const rows = (Array.isArray(body?.samples) ? body!.samples : [])
    .slice(0, 100)
    .filter((s) => KINDS.has(s?.k) && typeof s.n === "string" && Number.isFinite(s.ms) && s.ms >= 0 && s.ms < 600_000)
    .map((s) => ({ kind: s.k, name: s.n.slice(0, 120), ms: Math.round(s.ms), ok: s.ok !== false, path: typeof s.p === "string" ? pagePath(s.p).slice(0, 200) : null }));
  if (!rows.length) return NextResponse.json({ ok: true });
  const { user } = await getAuth().catch(() => ({ user: null }));
  const db = createAdminClient();
  // Now and then, clear out timings older than 7 days so the log stays small
  if (Math.random() < 0.02) {
    await db.from("speed_samples").delete().lt("at", new Date(Date.now() - 7 * 86400_000).toISOString()).then(
      () => null,
      () => null,
    );
  }
  await db
    .from("speed_samples")
    .insert(rows.map((r) => ({ ...r, user_id: user?.id ?? null })))
    .then(
      () => null,
      () => null,
    );
  return NextResponse.json({ ok: true });
}
