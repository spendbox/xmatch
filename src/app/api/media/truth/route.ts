import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { r2Enabled, uploadLink } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** An upload link for your voice answer to today's Truth (already disguised on your phone) */
export async function POST() {
  if (!r2Enabled()) return NextResponse.json({ error: "Voice answers aren't switched on yet." }, { status: 404 });
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  // Kept in your own folder: the database only accepts keys under truth/<you>/
  const key = `truth/${user.id}/${randomUUID()}.wav`;
  return NextResponse.json({ key, upload: await uploadLink(key) });
}
