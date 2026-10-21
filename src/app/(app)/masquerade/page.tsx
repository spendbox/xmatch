import { redirect } from "next/navigation";

// The Masquerade setup now lives on Home
export default function MasqueradePage() {
  redirect("/home");
}
