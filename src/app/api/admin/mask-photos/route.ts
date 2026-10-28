import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { publicUrl, r2Enabled, uploadLink } from "@/lib/r2";
import { PLACEHOLDER } from "@/lib/photoSet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin → Mask photos: masking every member's photos from the admin's browser (the face finder
 * runs there). GET ?list=1 lists the photos still waiting; GET ?user=…&url=… sends one original;
 * POST saves its masked copy in the member's folder and puts it on their profile.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Admins only" }, { status: 401 });
  const db = createAdminClient();
  const q = new URL(req.url).searchParams;

  if (q.get("list")) {
    const todo: { user: string; index: number; url: string; name: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("profiles").select("id, display_name, photos, real_photos").contains("photos", [PLACEHOLDER]).range(from, from + 999);
      for (const p of data ?? []) {
        (p.photos as string[]).forEach((u, i) => {
          const real = (p.real_photos as string[] | null)?.[i];
          if (u === PLACEHOLDER && real && real !== PLACEHOLDER) todo.push({ user: p.id as string, index: i, url: real, name: (p.display_name as string | null) ?? null });
        });
      }
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ todo });
  }

  const user = q.get("user") ?? "";
  const url = q.get("url") ?? "";
  const { data: p } = await db.from("profiles").select("real_photos").eq("id", user).maybeSingle();
  if (!p || !((p.real_photos as string[] | null) ?? []).includes(url) || !/^https:\/\//.test(url)) return NextResponse.json({ error: "Not their photo" }, { status: 404 });
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (Dashpad photo masking)", Accept: "image/*" } }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: `That photo won't load (${res?.status ?? "network"})` }, { status: 502 });
  const type = res.headers.get("Content-Type") ?? "";
  if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    return NextResponse.json({ error: `The photo's address gave back ${type.split(";")[0]}, not a photo` }, { status: 502 });
  }
  return new NextResponse(res.body, { headers: { "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg", "Cache-Control": "no-store" } });
}

/**
 * POST { action: "links", user }: where to upload a masked copy (straight to storage, so big photos
 * never pass through here). POST { action: "attach", user, index, url, mask, masked }: put it on their profile.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Admins only" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    user?: string;
    index?: number;
    url?: string;
    masked?: string;
    mask?: { mask?: string; faces?: unknown[] };
  } | null;
  const user = String(body?.user ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(user)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const db = createAdminClient();

  if (body?.action === "links") {
    const id = randomUUID();
    if (r2Enabled()) {
      const key = `photos/${user}/${id}.jpg`;
      const [full, thumb] = await Promise.all([uploadLink(key), uploadLink(key.replace(/\.jpg$/, "_t.jpg"))]);
      return NextResponse.json({ kind: "r2", url: publicUrl(key), upload: full, uploadThumb: thumb });
    }
    const store = db.storage.from("photos");
    const path = `${user}/${id}.jpg`;
    const [full, thumb] = await Promise.all([store.createSignedUploadUrl(path), store.createSignedUploadUrl(`${user}/${id}_t.jpg`)]);
    if (full.error || !full.data) return NextResponse.json({ error: full.error?.message ?? "Couldn't get an upload link" }, { status: 500 });
    return NextResponse.json({ kind: "supabase", url: store.getPublicUrl(path).data.publicUrl, path, token: full.data.token, thumbPath: thumb.data?.path, thumbToken: thumb.data?.token });
  }

  if (body?.action === "attach") {
    const index = Number(body.index);
    const url = String(body.url ?? "");
    const masked = String(body.masked ?? "");
    const mask = body.mask;
    // Only a file in their own folder
    const inFolder = (r2Enabled() && masked.startsWith(publicUrl(`photos/${user}/`))) || masked.includes(`/storage/v1/object/public/photos/${user}/`);
    if (!Number.isInteger(index) || !mask?.mask || !Array.isArray(mask.faces) || !inFolder) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const { data: p } = await db.from("profiles").select("photos, real_photos, photo_masks").eq("id", user).maybeSingle();
    const photos = [...((p?.photos as string[] | null) ?? [])];
    const real = (p?.real_photos as string[] | null) ?? [];
    // Only if that photo is still waiting (they may have changed things meanwhile)
    if (photos[index] !== PLACEHOLDER || real[index] !== url) return NextResponse.json({ ok: true, skipped: "changed" });
    photos[index] = masked;
    const masks = [...(((p?.photo_masks as unknown[]) ?? []) as unknown[])];
    while (masks.length < photos.length) masks.push(null);
    masks[index] = { mask: String(mask.mask), color: null, trim: "gold", faces: mask.faces, auto: true };
    const { error } = await db.from("profiles").update({ photos, photo_masks: masks }).eq("id", user);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: masked });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
