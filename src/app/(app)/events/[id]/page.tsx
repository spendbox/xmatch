import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import type { DashpadEvent } from "@/lib/events";
import { EventLobby } from "@/components/events/EventLobby";
import { EventSpace } from "@/components/events/space/EventSpace";

export const metadata = { title: "Event" };

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ next?: string }> }) {
  const { id } = await params;
  const { next } = await searchParams;
  const { supabase, user } = await getAuth();
  const { data } = await supabase.rpc("get_event", { p_event: id });
  if (!data) notFound();
  const event = data as DashpadEvent;
  if ((event.kind ?? "masquerade") === "masquerade") {
    return <EventLobby event={event} userId={user!.id} autoJoin={next === "1"} />;
  }
  const { data: me } = await supabase.from("profiles").select("photos, interests").eq("id", user!.id).single();
  return (
    <EventSpace
      event={event}
      userId={user!.id}
      myPhotos={(me?.photos ?? []) as string[]}
      myInterests={(me?.interests ?? []) as string[]}
    />
  );
}
