import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import { EventsScreen } from "@/components/events/EventsScreen";

export const metadata = { title: "Masquerade Nights" };

export default async function EventsPage() {
  const { supabase } = await getAuth();
  const { data } = await supabase.rpc("list_events");
  return <EventsScreen events={(data ?? []) as DashpadEvent[]} />;
}
