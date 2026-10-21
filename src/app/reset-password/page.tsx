import Link from "next/link";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Set a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthShell title="Link missing" subtitle="Open the link from your email, or request a new one.">
        <Link href="/forgot-password" className="flex h-14 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
          Request a new link
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Set a new password" subtitle="Choose something you haven't used before.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
