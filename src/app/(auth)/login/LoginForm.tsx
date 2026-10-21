"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { logIn } from "../actions";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Label } from "@/components/ui/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState(logIn, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="identifier">Email or phone</Label>
        <Input id="identifier" name="identifier" autoComplete="username"
          placeholder="you@example.com or +234…" defaultValue={state?.values?.identifier} required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password"
            placeholder="Your password" required className="pr-12" />
          <button type="button" onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
            aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" loading={pending}>
        Log in
      </Button>
    </form>
  );
}
