import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { r2Enabled, uploadLink } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** An upload link for your voice intro (already disguised on the phone, unless you chose your real voice) */
export async function POST() {
  if (!r2Enabled()) return NextResponse.json({ error: "Voice intros aren't switched on yet." }, { status: 404 });
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  // Kept in your own folder: the database only accepts keys under intro/<you>/
  const key = `intro/${user.id}/${randomUUID()}.wav`;
  return NextResponse.json({ key, upload: await uploadLink(key) });
}
