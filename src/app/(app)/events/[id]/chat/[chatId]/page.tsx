import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import type { EventChatDetail } from "@/lib/events";
import { EventChat } from "@/components/events/space/EventChat";

export const metadata = { title: "Event chat" };

export default async function EventChatPage({ params }: { params: Promise<{ id: string; chatId: string }> }) {
  const { id, chatId } = await params;
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("get_event_chat", { p_chat: chatId });
  const chat = data as EventChatDetail | null;
  if (!chat || chat.event_id !== id) notFound();
  // Both kept it: the conversation now lives in Chats
  if (chat.status === "matched" && chat.match_id) redirect(`/matches/${chat.match_id}`);
  const { data: me } = await supabase.from("profiles").select("interests").eq("id", user.id).single();
  return <EventChat chat={chat} myId={user.id} myInterests={(me?.interests ?? []) as string[]} />;
}
