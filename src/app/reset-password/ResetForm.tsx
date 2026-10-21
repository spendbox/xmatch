"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setNewPassword } from "@/app/(auth)/actions";
import { PasswordField } from "@/app/(auth)/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormError, Label } from "@/components/ui/Field";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">New password</Label>
        <PasswordField autoComplete="new-password" placeholder="At least 8 characters" meter />
      </div>
      <FormError message={state?.error} />
      {state?.error?.includes("request a new") && (
        <Link href="/forgot-password" className="block text-center text-[14px] font-semibold text-brand">Request a new link</Link>
      )}
      <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
        Save new password
      </Button>
    </form>
  );
}
