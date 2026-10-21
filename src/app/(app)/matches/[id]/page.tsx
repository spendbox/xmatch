import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, Profile } from "@/lib/types";
import { MatchChat } from "@/components/matches/MatchChat";

export const metadata = { title: "Chat" };

export default async function MatchChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) notFound();
  const otherId = match.user_a === user.id ? match.user_b : match.user_a;

  const [{ data: other }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", otherId).single(),
    supabase.from("messages").select("id, sender_id, body, created_at").eq("match_id", id).order("id").limit(500),
  ]);
  if (!other) notFound();

  return <MatchChat matchId={id} myId={user.id} other={other as Profile} initialMessages={(messages ?? []) as ChatMessage[]} />;
}
