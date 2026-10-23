import { FEATURES } from "@/lib/features";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import type { Feed } from "@/lib/feed";
import type { Wallet } from "@/lib/keys";
import { FeedScreen } from "@/components/feed/FeedScreen";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  if (!FEATURES.feed) redirect("/home"); // Daily prompts are switched off
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  const [{ data: feed }, { data: wallet }] = await Promise.all([supabase.rpc("get_feed", { p_sort: "new", p_limit: 30, p_offset: 0 }), supabase.rpc("my_wallet")]);
  return <FeedScreen initial={(feed as Feed) ?? { prompt: null, gifts_unseen: 0 }} myId={user.id} wallet={(wallet as Wallet) ?? null} />;
}
