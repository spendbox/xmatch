"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { logIn } from "../actions";
import { PasswordField } from "../PasswordField";
import { Button } from "@/components/ui/Button";
import { FormError, IconInput, Label } from "@/components/ui/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState(logIn, undefined);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <IconInput id="email" name="email" type="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" defaultValue={state?.values?.email} required
          icon={<Mail size={19} strokeWidth={1.75} />} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="-mt-2 text-[13px] font-semibold text-brand">
            Forgot password?
          </Link>
        </div>
        <PasswordField autoComplete="current-password" placeholder="Your password" />
      </div>

      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Logging you in…">
        Log in
      </Button>
    </form>
  );
}
