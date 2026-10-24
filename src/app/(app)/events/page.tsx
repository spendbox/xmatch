import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import { livePacts } from "@/lib/pactsServer";
import { EventsScreen } from "@/components/events/EventsScreen";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const { supabase } = await getAuth();
  const [{ data }, pacts] = await Promise.all([supabase.rpc("list_events"), livePacts()]);
  return <EventsScreen events={(data ?? []) as DashpadEvent[]} pacts={pacts} />;
}
