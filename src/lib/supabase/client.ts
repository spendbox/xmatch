import { createBrowserClient } from "@supabase/ssr";
import { timedFetch } from "@/lib/speedLog";
import { currentPath, recordSpeed } from "@/lib/speedClient";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Each request is timed for the speed log (Admin → Speed)
    { global: { fetch: timedFetch(recordSpeed, "browser", currentPath) } },
  );
}
