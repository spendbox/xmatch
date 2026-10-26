import { notFound, redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { ChatMessage, Profile } from "@/lib/types";
import { MatchChat } from "@/components/matches/MatchChat";

export const metadata = { title: "Chat" };

export default async function MatchChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) notFound();
  const otherId = match.user_a === user.id ? match.user_b : match.user_a;

  // The latest 500 messages (newest first from the database, then put back in order)
  const [{ data: other }, { data: messages }, { data: me }, { data: cost }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", otherId).single(),
    supabase.from("messages").select("*").eq("match_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500),
    supabase.from("profiles").select("interests").eq("id", user.id).single(),
    supabase.from("app_settings").select("value").eq("key", "slow_reveal_cost").maybeSingle(),
  ]);
  const shared = ((other?.interests ?? []) as string[]).filter((t) => ((me?.interests ?? []) as string[]).includes(t));
  if (!other) notFound();

  return <MatchChat matchId={id} myId={user.id} other={other as Profile} initialMessages={((messages ?? []) as ChatMessage[]).reverse()} shared={shared} matchedAt={match.created_at} intent={match.intent} slowCost={(cost?.value as number | undefined) ?? 10} source={match.source as string | null} chatBg={(match.chat_bg as string | null | undefined) ?? null} />;
}
