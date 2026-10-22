import { getAuth, getMatches } from "@/lib/auth";
import { YourPeople } from "@/components/matches/YourPeople";

export const metadata = { title: "Your people" };

export default async function PeoplePage() {
  const { user } = await getAuth();
  const matches = await getMatches();
  return <YourPeople matches={matches} myId={user!.id} />;
}
