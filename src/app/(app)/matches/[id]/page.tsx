import { notFound, redirect } from "next/navigation";
import { getAuth, getMyProfile } from "@/lib/auth";
import type { ChatMessage, Profile } from "@/lib/types";
import { MatchChat } from "@/components/matches/MatchChat";
import { CHAT_PAGE } from "@/lib/chatPage";
import { getAppConfig } from "@/lib/appConfig";

export const metadata = { title: "Chat" };

export default async function MatchChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");

  // Everything that doesn't depend on who the other person is, all at once
  const [{ data: match }, { data: messages }, me, config] = await Promise.all([
    supabase.from("matches").select("*").eq("id", id).maybeSingle(),
    // The latest messages only (newest first, then put back in order): older ones load when asked
    supabase.from("messages").select("*").eq("match_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CHAT_PAGE),
    getMyProfile(),
    getAppConfig().catch(() => null),
  ]);
  if (!match) notFound();
  const otherId = match.user_a === user.id ? match.user_b : match.user_a;
  const { data: other } = await supabase.from("profiles").select("*").eq("id", otherId).single();
  const cost = config?.settings?.find((r) => r.key === "slow_reveal_cost");
  const shared = ((other?.interests ?? []) as string[]).filter((t) => ((me?.interests ?? []) as string[]).includes(t));
  if (!other) notFound();
  // You both unmasked: their real photos
  if ((other.real_photos as string[] | null)?.length) other.photos = other.real_photos;

  return <MatchChat matchId={id} myId={user.id} other={other as Profile} initialMessages={((messages ?? []) as ChatMessage[]).reverse()} hasOlder={(messages?.length ?? 0) >= CHAT_PAGE} shared={shared} matchedAt={match.created_at} intent={match.intent} slowCost={(cost?.value as number | undefined) ?? 10} source={match.source as string | null} chatBg={(match.chat_bg as string | null | undefined) ?? null} />;
}
