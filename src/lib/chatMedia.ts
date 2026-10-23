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

/** A tiny picture (about 40px) of a photo or a video's first moments: all the other person gets of a slow reveal until it clears */
async function tinyPreview(file: Blob, kind: "image" | "video"): Promise<Blob | null> {
  try {
    let source: CanvasImageSource;
    let w: number;
    let h: number;
    if (kind === "image") {
      const bmp = await createImageBitmap(file);
      [source, w, h] = [bmp, bmp.width, bmp.height];
    } else {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => {
          v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
        };
        v.onseeked = () => resolve();
        v.onerror = () => reject(new Error("video"));
        setTimeout(() => reject(new Error("slow")), 6000);
      });
      [source, w, h] = [v, v.videoWidth, v.videoHeight];
    }
    const scale = 40 / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.7));
  } catch {
    return null;
  }
}

export async function uploadChatMedia(
  supabase: SupabaseClient,
  matchId: string,
  file: Blob,
  kind: "image" | "video" | "audio",
  slow = false,
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
  const id = crypto.randomUUID();
  const path = `${matchId}/${id}.${extFor(mime)}`;
  if (slow && kind !== "audio") {
    const tiny = await tinyPreview(file, kind);
    if (tiny) {
      const p = `${matchId}/${id}_p.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(p, new Blob([tiny], { type: "image/jpeg" }), { contentType: "image/jpeg", cacheControl: "31536000" });
      if (!error) meta = { ...meta, preview: p };
    }
  }
  // Files never change once sent, so phones can keep them (saves downloading them again)
  // Storage reads the type from the file itself, so give it the plain one ("audio/webm", not "audio/webm;codecs=opus")
  const body = blob.type === mime ? blob : new Blob([blob], { type: mime });
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: mime, cacheControl: "31536000" });
  if (error) throw error;
  return { path, meta: { ...meta, mime } };
}

// Private links last a week and are remembered on the phone. Reusing the same link means the
// browser can show the photo/video from its cache instead of downloading it again every visit.
const LINK_SECONDS = 7 * 24 * 3600;
const cache = new Map<string, { url: string; expires: number }>();
const STORE = "dp-media-links";

function loadStore(): Record<string, { url: string; expires: number }> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}
function saveStore(path: string, entry: { url: string; expires: number }) {
  try {
    const all = loadStore();
    const now = Date.now();
    for (const k of Object.keys(all)) if (all[k].expires < now) delete all[k];
    all[path] = entry;
    const keys = Object.keys(all);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete all[k];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {}
}

export async function signedUrl(supabase: SupabaseClient, path: string) {
  const hit = cache.get(path) ?? loadStore()[path];
  if (hit && hit.expires > Date.now()) {
    cache.set(path, hit);
    return hit.url;
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, LINK_SECONDS);
  if (!data?.signedUrl) return null;
  const entry = { url: data.signedUrl, expires: Date.now() + (LINK_SECONDS - 3600) * 1000 };
  cache.set(path, entry);
  saveStore(path, entry);
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
