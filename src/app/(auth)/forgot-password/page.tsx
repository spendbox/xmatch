import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Reset password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle={expired ? "That link has expired. Enter your email and we'll send a fresh one." : "Enter your email and we'll send you a link to set a new one."}
      footer={
        <Link href="/login" className="font-semibold text-brand">
          Back to log in
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
