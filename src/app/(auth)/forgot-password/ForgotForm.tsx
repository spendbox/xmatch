"use client";

import { useActionState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { Button } from "@/components/ui/Button";
import { FormError, IconInput, Label } from "@/components/ui/Field";

export function ForgotForm({ initialEmail }: { initialEmail?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.sent) {
    return (
      <div className="animate-pop py-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint">
          <MailCheck size={26} strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-[17px] font-semibold">Check your inbox</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          If <span className="font-semibold text-ink">{state.email}</span> has a Dashpad account, a reset link is on its way. It may take a minute — check spam too.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <IconInput id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com"
          defaultValue={state?.email ?? initialEmail} required icon={<Mail size={19} strokeWidth={1.75} />} />
      </div>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Sending link…">
        Send reset link
      </Button>
    </form>
  );
}
