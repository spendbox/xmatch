import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "chat-media";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/** Shrinks photos before sending. Videos and voice notes are sent as they are. */
async function compressImage(file: File): Promise<{ blob: Blob; width?: number; height?: number }> {
  if (file.type === "image/gif") return { blob: file };
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file };
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b ?? file), "image/jpeg", 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

function extFor(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("quicktime")) return "mov";
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("audio/mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Reads how long a video or audio file is, and a video's size. */
export function readMediaInfo(src: string, kind: "video" | "audio"): Promise<{ duration?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    const done = () => {
      const d = Number.isFinite(el.duration) ? Math.round(el.duration) : undefined;
      resolve(kind === "video" ? { duration: d, width: (el as HTMLVideoElement).videoWidth, height: (el as HTMLVideoElement).videoHeight } : { duration: d });
    };
    el.onloadedmetadata = done;
    el.onerror = () => resolve({});
    setTimeout(() => resolve({}), 4000);
    el.src = src;
  });
}

export async function uploadChatMedia(
  supabase: SupabaseClient,
  matchId: string,
  file: Blob,
  kind: "image" | "video" | "audio",
) {
  let blob = file;
  let meta: Record<string, unknown> = {};
  if (kind === "image" && file instanceof File) {
    const c = await compressImage(file);
    blob = c.blob;
    meta = { width: c.width, height: c.height };
  }
  if (blob.size > MAX_MEDIA_BYTES) throw new Error("That file is too big. The limit is 50 MB.");
  const mime = (blob.type || (kind === "audio" ? "audio/webm" : "application/octet-stream")).split(";")[0];
  const path = `${matchId}/${crypto.randomUUID()}.${extFor(mime)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mime, cacheControl: "3600" });
  if (error) throw error;
  return { path, meta: { ...meta, mime } };
}

// Short-lived private links, cached so we don't ask twice
const cache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(supabase: SupabaseClient, path: string) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60_000 });
  return data.signedUrl;
}

export async function removeChatMedia(supabase: SupabaseClient, path: string | null | undefined) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export function formatDuration(s: number | undefined) {
  if (!s || !Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
