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

export async function uploadPhoto(supabase: SupabaseClient, userId: string, file: File) {
  const [blob, small] = await Promise.all([compress(file), compress(file, THUMB_SIZE)]);
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
  return /\/storage\/v1\/object\/public\/photos\/[^?]+\.jpg$/.test(url) && !url.endsWith(`${THUMB_SUFFIX}.jpg`) ? url.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`) : url;
}

/** For <img onError>: if the small copy isn't there, show the full photo */
export function thumbFallback(full: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (full && e.currentTarget.src !== full) e.currentTarget.src = full;
  };
}

export async function deletePhoto(supabase: SupabaseClient, url: string) {
  const marker = "/storage/v1/object/public/photos/";
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length);
  await supabase.storage.from("photos").remove([path, path.replace(/\.jpg$/, `${THUMB_SUFFIX}.jpg`)]);
}
