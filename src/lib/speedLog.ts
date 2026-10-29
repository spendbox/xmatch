/**
 * The speed log (Admin → Speed): how long pages take to open and how long each request to the
 * database takes. Shared by the phone (lib/speedClient) and the server (lib/supabase/server).
 */

export type SpeedKind = "page" | "browser" | "server";
export type SpeedSample = { k: SpeedKind; n: string; ms: number; ok: boolean; p?: string };

/** "rpc get_matches", "table messages", "auth", or null for things not worth timing (live updates) */
export function requestName(url: string): string | null {
  const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/i);
  if (m) return m[1] ? `rpc ${m[2]}` : `table ${m[2]}`;
  if (url.includes("/auth/v1/")) return "auth";
  if (url.includes("/storage/v1/")) return "storage";
  return null;
}

/** /matches/5f2c… → /matches/[id], so every chat counts as one page */
export function pagePath(path: string) {
  return (
    path
      .split("?")[0]
      .split("/")
      .map((s) => (/^[0-9a-f-]{16,}$/i.test(s) || /^\d+$/.test(s) ? "[id]" : s))
      .join("/") || "/"
  );
}

/** The last time the app went into the background (phones pause requests then, which isn't slowness) */
let hiddenAt = 0;
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = performance.now();
  });
}

/** Requests to the database from phones give up after this long, so a dead connection can't hang the app */
const PHONE_TIMEOUT_MS = 15_000;

/** A fetch that times each request to the database and hands it to `record` */
export function timedFetch(record: (s: SpeedSample) => void, kind: Exclude<SpeedKind, "page">, path?: () => string | undefined): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const name = requestName(url);
    if (!name) return fetch(input, init);
    // On phones: stop waiting on a stuck request (database reads and calls only, never uploads)
    let stop: (() => void) | null = null;
    if (kind === "browser" && url.includes("/rest/v1/")) {
      const ctl = new AbortController();
      const outer = init?.signal;
      if (outer) {
        if (outer.aborted) ctl.abort(outer.reason);
        else outer.addEventListener("abort", () => ctl.abort(outer.reason), { once: true });
      }
      const t = setTimeout(() => ctl.abort(new DOMException("The request took too long", "TimeoutError")), PHONE_TIMEOUT_MS);
      stop = () => clearTimeout(t);
      init = { ...init, signal: ctl.signal };
    }
    const t0 = performance.now();
    // Only count it if the app stayed open and online the whole time
    const fair = () => kind !== "browser" || (hiddenAt < t0 && document.visibilityState === "visible" && navigator.onLine !== false);
    try {
      const res = await fetch(input, init);
      if (fair()) record({ k: kind, n: name, ms: Math.round(performance.now() - t0), ok: res.ok, p: path?.() });
      return res;
    } catch (e) {
      if (fair()) record({ k: kind, n: name, ms: Math.round(performance.now() - t0), ok: false, p: path?.() });
      throw e;
    } finally {
      stop?.();
    }
  };
}
