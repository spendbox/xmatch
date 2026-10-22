import { redirect } from "next/navigation";

// Events now live on the Meet page
export default function EventsPage() {
  redirect("/meet?tab=events");
}
