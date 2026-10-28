import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

/**
 * One of your own photos, served from Dashpad's address so the app can draw on it (to change its
 * mask). Only photos on your own profile are served, and only to you.
 */
export async function GET(req: Request) {
  const { supabase, user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const { data: me } = await supabase.from("profiles").select("photos, real_photos").eq("id", user.id).single();
  const mine = [...((me?.real_photos as string[] | null) ?? []), ...((me?.photos as string[] | null) ?? [])];
  if (!url || !mine.includes(url) || !/^https:\/\//.test(url)) return NextResponse.json({ error: "Not your photo" }, { status: 404 });
  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "That photo won't load" }, { status: 502 });
  return new NextResponse(res.body, { headers: { "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg", "Cache-Control": "private, max-age=600" } });
}
