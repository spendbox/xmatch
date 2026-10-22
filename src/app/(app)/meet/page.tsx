import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import type { MeetList } from "@/lib/meets";
import { MeetScreen } from "@/components/meets/MeetScreen";

export const metadata = { title: "Meet" };

export default async function MeetPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { supabase } = await getAuth();
  const [{ data: meets }, { data: events }] = await Promise.all([supabase.rpc("list_meets", { p_limit: 30 }), supabase.rpc("list_events")]);
  return <MeetScreen initial={(meets as MeetList | null) ?? null} events={(events ?? []) as DashpadEvent[]} tab={tab === "events" ? "events" : "meets"} />;
}
