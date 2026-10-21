import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import type { FeedChatDetail } from "@/lib/feed";
import { FeedChat } from "@/components/feed/FeedChat";

export const metadata = { title: "Feed chat" };

export default async function FeedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("get_feed_chat", { p_chat: id });
  const chat = data as FeedChatDetail | null;
  if (!chat) notFound();
  // Both kept it: the conversation now lives in Chats
  if (chat.status === "matched" && chat.match_id) redirect(`/matches/${chat.match_id}`);
  return <FeedChat chat={chat} myId={user.id} />;
}
