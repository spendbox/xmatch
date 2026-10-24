import { notFound, redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { ChatMessage, MasqueradeState } from "@/lib/types";
import { MasqueradeRoom } from "@/components/masquerade/MasqueradeRoom";

export const metadata = { title: "Masked chat" };

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  const { data: state } = await supabase.rpc("get_masquerade", { p_session: id });
  if (!state) notFound();

  const [{ data: messages }, { data: eventId }, { data: pact }] = await Promise.all([
    supabase.from("masquerade_messages").select("*").eq("session_id", id).order("id"),
    supabase.rpc("session_event", { p_session: id }),
    supabase.rpc("pact_chat_info", { p_session: id }),
  ]);
  // A pact match is revealed with a tap on the pact's page first
  const pactInfo = pact as { name: string; slug: string; seen: boolean } | null;
  if (pactInfo && !pactInfo.seen) redirect(`/link/${pactInfo.slug}`);

  return (
    <MasqueradeRoom
      initial={state as MasqueradeState}
      initialMessages={(messages ?? []) as ChatMessage[]}
      eventId={(eventId as string | null) ?? null}
      pact={pactInfo?.name ?? null}
    />
  );
}
