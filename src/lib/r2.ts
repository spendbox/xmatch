import "server-only";
import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 for photos (no download fees). Switched on when these are set in Vercel:
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and NEXT_PUBLIC_MEDIA_URL
 * (e.g. https://media.dashpad.site, the bucket's own address). Until then, Supabase storage is used.
 */
export function r2Enabled() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && mediaBase());
}

/** e.g. https://media.dashpad.site (no slash at the end) */
export function mediaBase() {
  return (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
}

let client: AwsClient | null = null;
function r2() {
  client ??= new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  return client;
}

const endpoint = () => `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`;
const objectUrl = (key: string) => `${endpoint()}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** A one-time link the phone uploads a file to directly (valid for 10 minutes) */
export async function uploadLink(key: string) {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await r2().sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
  return signed.url;
}

/** Where a stored file is served from */
export const publicUrl = (key: string) => `${mediaBase()}/${key}`;

/** The stored file's key, if this address is one of ours */
export function keyFromUrl(url: string) {
  const base = mediaBase();
  if (!base || !url.startsWith(base + "/")) return null;
  return decodeURIComponent(url.slice(base.length + 1).split("?")[0]);
}

export async function deleteKeys(keys: string[]) {
  if (!r2Enabled()) return;
  await Promise.all(keys.map((k) => r2().fetch(objectUrl(k), { method: "DELETE" }).catch(() => null)));
}

/** Every file under a folder, e.g. photos/<user id>/ (up to 1,000) */
export async function listKeys(prefix: string) {
  if (!r2Enabled()) return [];
  const res = await r2().fetch(`${endpoint()}?list-type=2&prefix=${encodeURIComponent(prefix)}`).catch(() => null);
  if (!res?.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

/** Deletes everything in someone's photo folder (account deletion) */
export async function deletePhotoFolder(userId: string) {
  if (!r2Enabled() || !/^[0-9a-f-]{36}$/i.test(userId)) return;
  await deleteKeys(await listKeys(`photos/${userId}/`));
}
