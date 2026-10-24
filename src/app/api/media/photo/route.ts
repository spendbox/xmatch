import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { deleteKeys, keyFromUrl, publicUrl, r2Enabled, uploadLink } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** Upload links for a new profile photo (full size and the small copy), straight to R2 */
export async function POST() {
  if (!r2Enabled()) return NextResponse.json({ fallback: true }, { status: 404 });
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const key = `photos/${user.id}/${randomUUID()}.jpg`;
  const thumb = key.replace(/\.jpg$/, "_t.jpg");
  const [full, small] = await Promise.all([uploadLink(key), uploadLink(thumb)]);
  return NextResponse.json({ url: publicUrl(key), upload: full, uploadThumb: small });
}

/** Deletes one of your photos (and its small copy) from R2 */
export async function DELETE(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { url } = ((await req.json().catch(() => ({}))) ?? {}) as { url?: string };
  const key = typeof url === "string" ? keyFromUrl(url) : null;
  // Only files in your own folder
  if (!key || !key.startsWith(`photos/${user.id}/`) || key.includes("..")) return NextResponse.json({ ok: true });
  await deleteKeys([key, key.replace(/(_t)?\.jpg$/, "_t.jpg")]);
  return NextResponse.json({ ok: true });
}
