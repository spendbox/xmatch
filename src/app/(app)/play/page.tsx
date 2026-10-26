import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { PlayScreen } from "@/components/play/PlayScreen";

export const metadata = { title: "Play" };

export default async function PlayPage() {
  const { user } = await getAuth();
  if (!user) redirect("/login");
  return <PlayScreen userId={user.id} />;
}
