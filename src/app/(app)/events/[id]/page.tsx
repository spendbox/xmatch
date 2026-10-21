import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import { EventLobby } from "@/components/events/EventLobby";

export const metadata = { title: "Masquerade Night" };

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ next?: string }> }) {
  const { id } = await params;
  const { next } = await searchParams;
  const { supabase, user } = await getAuth();
  const { data } = await supabase.rpc("get_event", { p_event: id });
  if (!data) notFound();
  return <EventLobby event={data as DashpadEvent} userId={user!.id} autoJoin={next === "1"} />;
}
