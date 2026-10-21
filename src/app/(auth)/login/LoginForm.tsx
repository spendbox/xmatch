"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import clsx from "clsx";
import { Mail, Smartphone } from "lucide-react";
import { logIn } from "../actions";
import { PasswordField } from "../PasswordField";
import { Button, tapFeedback } from "@/components/ui/Button";
import { FormError, IconInput, Label } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";

export function LoginForm() {
  const [state, action, pending] = useActionState(logIn, undefined);
  const [method, setMethod] = useState<"email" | "phone">(state?.values?.method === "phone" ? "phone" : "email");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="method" value={method} />
      <div role="tablist" aria-label="Log in with" className="relative grid grid-cols-2 rounded-2xl bg-cream p-1">
        <span
          aria-hidden
          className={clsx(
            "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-surface shadow-card transition-transform duration-300",
            method === "phone" && "translate-x-full",
          )}
        />
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => {
              tapFeedback();
              setMethod(m);
            }}
            className={clsx("relative flex h-11 items-center justify-center gap-2 text-[14px] font-semibold transition", method === m ? "text-ink" : "text-muted")}
          >
            {m === "email" ? <Mail size={17} /> : <Smartphone size={17} />}
            {m === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>

      {method === "email" ? (
        <div key="email" className="animate-fade-in">
          <Label htmlFor="email">Email</Label>
          <IconInput id="email" name="email" type="email" autoComplete="email" inputMode="email"
            placeholder="you@example.com" defaultValue={state?.values?.email} required
            icon={<Mail size={19} strokeWidth={1.75} />} />
        </div>
      ) : (
        <div key="phone" className="animate-fade-in">
          <Label htmlFor="phone">Phone number</Label>
          <PhoneInput name="phone" onChange={() => {}} />
          <p className="mt-2 text-[12px] text-muted">Only works if you&apos;ve added your phone in your profile.</p>
        </div>
      )}

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
