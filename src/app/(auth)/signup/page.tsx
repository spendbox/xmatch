import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Join the masquerade"
      subtitle="Just an email and a password. No codes, no hassle."
      badge={<span className="rounded-full bg-mint-soft px-3 py-1.5 text-[13px] font-semibold text-mint">Free · 18+</span>}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
