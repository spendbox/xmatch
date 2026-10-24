import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import { livePacts } from "@/lib/pactsServer";
import { EventsScreen } from "@/components/events/EventsScreen";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const { supabase, user } = await getAuth();
  const [{ data }, live, { data: mine }] = await Promise.all([
    supabase.rpc("list_events"),
    livePacts(),
    user ? supabase.from("pact_entries").select("pact_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { pact_id: string }[] }),
  ]);
  // Link-Ups you've answered open your answers to change them
  const taken = new Set((mine ?? []).map((r) => r.pact_id as string));
  const pacts = live.map((p) => ({ ...p, taken: taken.has(p.id) }));
  return <EventsScreen events={(data ?? []) as DashpadEvent[]} pacts={pacts} />;
}
