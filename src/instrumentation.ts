import type { Instrumentation } from "next";

export function register() {}

/** Errors on the server (a page or action that failed) go to Admin → App errors too */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    // Pages that don't exist and redirects aren't errors
    const e = err as Error & { digest?: string };
    if (/NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR_FALLBACK)/.test(e?.digest ?? "") || /NEXT_(NOT_FOUND|REDIRECT)/.test(e?.message ?? "")) return;
    const { createAdminClient } = await import("@/lib/supabase/server");
    await createAdminClient()
      .from("client_errors")
      .insert({
        message: `[server] ${String(e?.message ?? err).slice(0, 480)}`,
        stack: `build ${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)} · ${context.routeType} ${context.routePath}\n${String(e?.stack ?? "").slice(0, 3500)}`,
        url: String(request.path ?? "").slice(0, 300),
        agent: null,
      });
  } catch {}
};
