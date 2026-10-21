"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/app/(auth)/actions";
import { PasswordField } from "@/app/(auth)/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormError, Label } from "@/components/ui/Field";

export function ResetForm() {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="password">New password</Label>
        <PasswordField autoComplete="new-password" placeholder="At least 8 characters" meter />
      </div>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
        Save new password
      </Button>
    </form>
  );
}
