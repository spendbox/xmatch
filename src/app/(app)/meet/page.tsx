import { getAuth } from "@/lib/auth";
import { ExploreScreen } from "@/components/explore/ExploreScreen";

export const metadata = { title: "Meet" };

/** The list loads on the phone (and is kept there for a few minutes), so opening Meet stays cheap */
export default async function MeetPage() {
  const { user } = await getAuth();
  return <ExploreScreen initial={null} userId={user?.id} />;
}
