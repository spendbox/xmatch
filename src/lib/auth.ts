import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Who is logged in, worked out once per page load.
 * getClaims checks the login token locally when possible, which is much
 * faster than asking Supabase's servers every time.
 */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user = claims?.sub ? { id: claims.sub as string, email: (claims.email as string | undefined) ?? null } : null;
  return { supabase, user };
});

/** Your own profile, fetched at most once per page load. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getAuth();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

/** Your matches, fetched at most once per page load. */
export const getMatches = cache(async () => {
  const { supabase, user } = await getAuth();
  if (!user) return [];
  const { data } = await supabase.rpc("get_matches");
  return (data ?? []) as import("@/lib/types").MatchSummary[];
});
