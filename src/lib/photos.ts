import type { SupabaseClient } from "@supabase/supabase-js";

/** Shrinks a photo on the phone before uploading, so uploads are fast and cheap. */
async function compress(file: File, maxSize = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

/** Where new photos are served from when they're stored on Cloudflare R2 (empty: Supabase storage) */
const MEDIA = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");

/** Uploads straight to R2 with one-time links from the server. Null if R2 isn't switched on. */
async function uploadToR2(blob: Blob, small: Blob): Promise<string | null> {
  if (!MEDIA) return null;
  const res = await fetch("/api/media/photo", { method: "POST" }).catch(() => null);
  if (!res || res.status === 404) return null;
  const link = (await res.json().catch(() => null)) as { url?: string; upload?: string; uploadThumb?: string; error?: string } | null;
  if (!res.ok || !link?.url || !link.upload) throw new Error(link?.error ?? "The upload didn't finish. Please try again.");
  const put = (to: string, body: Blob) => fetch(to, { method: "PUT", body, headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  const done = await put(link.upload, blob).catch(() => null);
  if (!done?.ok) throw new Error("The upload didn't finish. Please try again.");
  // The small copy: if it fails, the full one is used
  if (link.uploadThumb) await put(link.uploadThumb, small).catch(() => null);
  return link.url;
}

export async function uploadPhoto(supabase: SupabaseClient, userId: string, file: File) {
  const [blob, small] = await Promise.all([compress(file), compress(file, THUMB_SIZE)]);
  const onR2 = await uploadToR2(blob, small);
  if (onR2) return onR2;
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  // A small copy for circles and grids (about a tenth of the size). If it fails, the full one is used.
  await supabase.storage
    .from("photos")
    .upload(`${userId}/${id}${THUMB_SUFFIX}.jpg`, small, { contentType: "image/jpeg", cacheControl: "31536000" })
    .catch(() => null);
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

const THUMB_SIZE = 400;
const THUMB_SUFFIX = "_t";

/** The small copy of a Dashpad photo (older photos don't have one: use onError to fall back) */
export function thumbUrl(url: string | null | undefined) {
  if (!url) return url ?? null;
  const ours = /\/storage\/v1\/object\/public\/photos\/[^?]+\.jpg$/.test(url) || (!!MEDIA && url.startsWith(`${MEDIA}/photos/`) && url.endsWith(".jpg"));
  return ours && !url.endsWith(`${THUMB_SUFFIX}.jpg`) ? url.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`) : url;
}

/** For <img onError>: if the small copy isn't there, show the full photo */
export function thumbFallback(full: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (full && e.currentTarget.src !== full) e.currentTarget.src = full;
  };
}

export async function deletePhoto(supabase: SupabaseClient, url: string) {
  if (MEDIA && url.startsWith(`${MEDIA}/`)) {
    await fetch("/api/media/photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => null);
    return;
  }
  const marker = "/storage/v1/object/public/photos/";
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length);
  await supabase.storage.from("photos").remove([path, path.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`)]);
}
