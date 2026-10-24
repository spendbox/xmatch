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

/** For the admin storage check: write, read back from the public address, and delete a tiny test file */
export async function testR2(): Promise<{ step: string; ok: boolean; detail?: string }[]> {
  const out: { step: string; ok: boolean; detail?: string }[] = [];
  const key = `_check/test-${Date.now()}.txt`;
  try {
    const put = await r2().fetch(objectUrl(key), { method: "PUT", body: "ok", headers: { "Content-Type": "text/plain" } });
    const text = put.ok ? "" : await put.text().catch(() => "");
    const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1];
    out.push({
      step: "Save a test file to the bucket",
      ok: put.ok,
      detail: put.ok
        ? undefined
        : code === "NoSuchBucket"
          ? `Bucket "${process.env.R2_BUCKET}" wasn't found. Check R2_BUCKET is exactly the bucket's name.`
          : put.status === 403 || code === "AccessDenied" || code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch"
            ? "Cloudflare refused the keys. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY, and that the API token has Object Read & Write on this bucket."
            : `Cloudflare said ${put.status}${code ? ` (${code})` : ""}.`,
    });
    if (!put.ok) return out;
  } catch (e) {
    out.push({ step: "Save a test file to the bucket", ok: false, detail: `Couldn't reach R2 (${e instanceof Error ? e.message : "network error"}). Check R2_ACCOUNT_ID.` });
    return out;
  }
  try {
    const read = await fetch(publicUrl(key), { cache: "no-store" });
    out.push({
      step: `Open it from ${mediaBase()}`,
      ok: read.ok,
      detail: read.ok ? undefined : `Got ${read.status}. In the bucket's Settings, connect the custom domain (${mediaBase().replace(/^https?:\/\//, "")}) and make sure it says Active.`,
    });
  } catch (e) {
    out.push({ step: `Open it from ${mediaBase()}`, ok: false, detail: `Couldn't open ${mediaBase()} (${e instanceof Error ? e.message : "network error"}). The custom domain may not be connected yet, or NEXT_PUBLIC_MEDIA_URL has a typo.` });
  }
  const del = await r2().fetch(objectUrl(key), { method: "DELETE" }).catch(() => null);
  out.push({ step: "Delete the test file", ok: !!del?.ok, detail: del?.ok ? undefined : "Couldn't delete it. The API token needs Object Read & Write." });
  return out;
}

/** For the admin storage check: an upload link the browser uses to test the bucket's CORS settings */
export async function testUploadLink() {
  const key = `_check/browser-${Date.now()}.txt`;
  return { key, upload: await uploadLink(key) };
}
