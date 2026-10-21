"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { signUp } from "../actions";
import { PasswordField } from "../PasswordField";
import { Button } from "@/components/ui/Button";
import { CheckRow, FormError, IconInput, Label } from "@/components/ui/Field";
import { Turnstile } from "@/components/ui/Turnstile";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <IconInput id="email" name="email" type="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" defaultValue={state?.values?.email} required
          icon={<Mail size={19} strokeWidth={1.75} />} />
      </div>
      <div>
        <Label htmlFor="password">Create a password</Label>
        <PasswordField autoComplete="new-password" placeholder="At least 8 characters" meter />
      </div>

      <div className="space-y-2 rounded-2xl bg-cream p-3">
        <CheckRow name="age_ok">I&apos;m 18 or older.</CheckRow>
        <CheckRow name="terms_ok">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-brand underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-semibold text-brand underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          , including the Community Guidelines.
        </CheckRow>
      </div>

      {/* New check after every attempt, since each one can only be used once */}
      <Turnstile key={state?.at ?? state?.error ?? "first"} />
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Creating your account…">
        Create account
      </Button>
    </form>
  );
}
