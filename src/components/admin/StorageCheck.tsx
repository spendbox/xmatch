"use client";

import { useState } from "react";
import { CheckCircle2, CloudUpload, XCircle } from "lucide-react";
import { browserTestLink, checkStorage, cleanupTest, type CheckRow } from "@/app/admin/(panel)/storage/actions";

// Built into the app when Vercel builds it: empty means it was added after the last deploy
const BUILT_MEDIA = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");

/** Admin: is Cloudflare R2 set up for photos? Checks each part and says what to fix */
export function StorageCheck() {
  const [rows, setRows] = useState<CheckRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const out: CheckRow[] = [];
    out.push({
      step: "The app was built with the media address",
      ok: !!BUILT_MEDIA,
      detail: BUILT_MEDIA ? undefined : "The live app was built before NEXT_PUBLIC_MEDIA_URL was added, so it still uses Supabase. In Vercel → Deployments, redeploy the latest one.",
    });
    try {
      const server = await checkStorage();
      out.push(...server.rows);
      if (server.enabled && server.rows.every((r) => r.ok)) {
        // Uploads come straight from people's phones, so the bucket has to allow dashpad.site (CORS)
        const link = await browserTestLink();
        if (link) {
          const res = await fetch(link.upload, { method: "PUT", body: "ok", headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=31536000, immutable" } }).catch(() => null);
          out.push({
            step: "Upload from this browser (CORS)",
            ok: !!res?.ok,
            detail: res?.ok ? undefined : `The bucket blocked an upload from ${location.origin}. In the bucket's Settings → CORS policy, allow ${location.origin} with PUT and the headers Content-Type and Cache-Control.`,
          });
          await cleanupTest(link.key);
        }
      }
    } catch {
      out.push({ step: "Run the check", ok: false, detail: "The check itself failed. Try again in a minute." });
    }
    setRows(out);
    setBusy(false);
  }

  const allOk = rows?.every((r) => r.ok);
  return (
    <section className="mt-8 rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">Photo storage</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">New profile photos go to Cloudflare R2 once it&apos;s set up. Link-Up pictures, event media and chat photos still use Supabase.</p>
        </div>
        <button onClick={run} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white disabled:opacity-60">
          <CloudUpload size={17} /> {busy ? "Checking…" : rows ? "Check again" : "Check Cloudflare R2"}
        </button>
      </div>
      {rows && (
        <>
          <p className={"mt-4 rounded-2xl px-4 py-3 text-[14px] font-semibold " + (allOk ? "bg-mint/15 text-[#16865a]" : "bg-chili-soft text-chili")}>
            {allOk ? "Connected. New profile photos are going to Cloudflare R2." : "Not fully connected yet. Fix the first red step below, then check again."}
          </p>
          <ul className="mt-3 grid gap-2">
            {rows.map((r) => (
              <li key={r.step} className="flex items-start gap-2.5 text-[14px]">
                {r.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#16865a]" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-chili" />}
                <span>
                  <span className="font-semibold">{r.step}</span>
                  {r.detail && <span className="block text-[13px] text-muted">{r.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
