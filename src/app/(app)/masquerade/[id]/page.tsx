import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, MasqueradeState } from "@/lib/types";
import { MasqueradeRoom } from "@/components/masquerade/MasqueradeRoom";

export const metadata = { title: "Masked chat" };

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: state } = await supabase.rpc("get_masquerade", { p_session: id });
  if (!state) notFound();

  const { data: messages } = await supabase
    .from("masquerade_messages")
    .select("id, sender_id, kind, body, created_at")
    .eq("session_id", id)
    .order("id");

  return <MasqueradeRoom initial={state as MasqueradeState} initialMessages={(messages ?? []) as ChatMessage[]} />;
}
