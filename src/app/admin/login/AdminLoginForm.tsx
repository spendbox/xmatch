"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { adminLogin } from "../actions";
import { PasswordField } from "@/app/(auth)/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormError, IconInput, Label } from "@/components/ui/Field";
import { Turnstile } from "@/components/ui/Turnstile";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">Admin email</Label>
        <IconInput id="email" name="email" type="email" autoComplete="username" required icon={<Mail size={19} strokeWidth={1.75} />} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <PasswordField autoComplete="current-password" placeholder="Admin password" />
      </div>
      <Turnstile key={state?.at ?? "first"} />
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Checking…">
        Log in to admin
      </Button>
    </form>
  );
}
