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
  const blob = await compress(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

export async function deletePhoto(supabase: SupabaseClient, url: string) {
  const marker = "/storage/v1/object/public/photos/";
  const i = url.indexOf(marker);
  if (i === -1) return;
  await supabase.storage.from("photos").remove([url.slice(i + marker.length)]);
}
