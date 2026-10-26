"use client";

const seen = new Set<string>();

/** Send an app error to Dashpad so it can be fixed (each one once per visit) */
export function reportError(error: unknown, where?: string) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = `${where ? `[${where}] ` : ""}${e.message || "Unknown error"}`;
    if (seen.has(message)) return;
    seen.add(message);
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack: e.stack ?? null, url: location.pathname + location.search }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
