"use client";

const seen = new Set<string>();

/** Send an app error to Dashpad so it can be fixed (each one once per visit) */
export function reportError(error: unknown, where?: string) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = `${where ? `[${where}] ` : ""}${e.message || "Unknown error"}`;
    // Once each, and never a flood from one phone
    if (seen.has(message) || seen.size >= 20) return;
    seen.add(message);
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        // Which version of the app it happened in
        stack: `build ${(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}\n${e.stack ?? ""}`,
        url: location.pathname + location.search,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
