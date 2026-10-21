import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Set a new password" };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?expired=1");
  return (
    <AuthShell title="Set a new password" subtitle="Choose something you haven't used before.">
      <ResetForm />
    </AuthShell>
  );
}
