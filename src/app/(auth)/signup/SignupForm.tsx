"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signUp } from "../actions";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Label } from "@/components/ui/Field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" defaultValue={state?.values?.email} required />
      </div>
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel"
          placeholder="+234 801 234 5678" defaultValue={state?.values?.phone} required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password"
            placeholder="At least 8 characters" minLength={8} required className="pr-12" />
          <button type="button" onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
            aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      <label className="flex items-start gap-3 text-[15px] leading-snug text-ink-soft">
        <input type="checkbox" name="age_ok" className="mt-0.5 h-5 w-5 shrink-0 accent-brand" required />
        I&apos;m 18 or older and I&apos;ll treat people with respect.
      </label>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending} loadingText="Creating your account…">
        Create account
      </Button>
    </form>
  );
}
