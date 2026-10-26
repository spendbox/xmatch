import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { timedFetch, type SpeedSample } from "@/lib/speedLog";

/** About 1 in 5 of the server's requests go in the speed log (Admin → Speed), saved after the page is sent */
function recordServer(path: string | undefined) {
  return (s: SpeedSample) => {
    if (Math.random() > 0.2) return;
    try {
      after(async () => {
        await createAdminClient()
          .from("speed_samples")
          .insert({ kind: "server", name: s.n, ms: s.ms, ok: s.ok, path: path ?? null })
          .then(
            () => null,
            () => null,
          );
      });
    } catch {
      /* not while building a page: skip */
    }
  };
}

export async function createClient() {
  const cookieStore = await cookies();
  // Which page is being built (set by the middleware), for the speed log
  const path = (await headers().catch(() => null))?.get("x-dp-path") ?? undefined;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: timedFetch(recordServer(path), "server") },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; the middleware keeps the session fresh.
          }
        },
      },
    },
  );
}

/** Server-only client with full access. Never import this in browser code. */
export function createAdminClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
