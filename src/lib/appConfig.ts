import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/** Tag for the shared app settings below; admin changes clear it straight away */
export const APP_CONFIG_TAG = "app-config";

/**
 * Prices and settings, gifts and the "Things about you" cards: the same for everyone and they
 * rarely change, so they're kept for a minute instead of fetched on every page (three fewer trips
 * to the database each time a page opens). Changing them in admin shows straight away.
 */
export const getAppConfig = unstable_cache(
  async () => {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [prompts, settings, gifts] = await Promise.all([
      db.from("thing_prompts").select("id, text, ideas, tone, sort, repeatable, active"),
      db.from("app_settings").select("key, value"),
      db.from("gifts").select("id, name, emoji, price, sort, retired").order("sort"),
    ]);
    // Don't keep a failure: the next page tries again
    if (settings.error || gifts.error) throw new Error("Couldn't load app settings");
    return { prompts: prompts.data ?? null, settings: settings.data ?? null, gifts: gifts.data ?? null };
  },
  ["app-config-v1"],
  { revalidate: 60, tags: [APP_CONFIG_TAG] },
);
