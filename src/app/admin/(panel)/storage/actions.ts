"use server";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteKeys, mediaBase, r2Enabled, testR2, testUploadLink } from "@/lib/r2";

export type CheckRow = { step: string; ok: boolean; detail?: string };

const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "NEXT_PUBLIC_MEDIA_URL"] as const;

/** Checks every part of the Cloudflare R2 setup, from the server's side */
export async function checkStorage(): Promise<{ rows: CheckRow[]; enabled: boolean; media: string }> {
  await requireAdmin();
  const rows: CheckRow[] = [];
  const missing = VARS.filter((v) => !process.env[v]);
  rows.push({
    step: "R2 settings in Vercel",
    ok: missing.length === 0,
    detail: missing.length ? `Missing: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables (for Production), then redeploy.` : undefined,
  });
  const media = mediaBase();
  if (missing.length) return { rows, enabled: false, media };

  // The database's photo check has to know the same address (update 57)
  const { data: dbBase, error } = await createAdminClient().rpc("media_base");
  rows.push({
    step: "Database knows the media address (update 57)",
    ok: !error && dbBase === media,
    detail: error
      ? "Update 57 hasn't run in Supabase yet."
      : dbBase !== media
        ? `The database has ${dbBase ?? "nothing"} but Vercel has ${media}. Run update 57 again with ${media} in it.`
        : undefined,
  });
  rows.push(...(await testR2()));
  return { rows, enabled: r2Enabled(), media };
}

/** A one-time upload link for the browser test (checks CORS) */
export async function browserTestLink() {
  await requireAdmin();
  if (!r2Enabled()) return null;
  return testUploadLink();
}

export async function cleanupTest(key: string) {
  await requireAdmin();
  if (/^_check\/[a-z0-9-]+\.txt$/.test(key)) await deleteKeys([key]);
}
