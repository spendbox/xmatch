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

  const { data: messages } = await supabase
    .from("masquerade_messages")
    .select("id, sender_id, kind, body, created_at, reply_to")
    .eq("session_id", id)
    .order("id");

  return <MasqueradeRoom initial={state as MasqueradeState} initialMessages={(messages ?? []) as ChatMessage[]} />;
}
