"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { checkEmail, logIn, signUp } from "./actions";
import { PasswordField } from "./PasswordField";
import { Button } from "@/components/ui/Button";
import { CheckRow, FormError, IconInput, Label } from "@/components/ui/Field";
import { Turnstile } from "@/components/ui/Turnstile";

type Step = "email" | "login" | "signup";

/**
 * One way in: type your email first. If there's an account, ask for the password;
 * if not, create one (then onboarding).
 */
export function AuthFlow({ demo }: { demo?: { step: Step; email: string } } = {}) {
  const [step, setStep] = useState<Step>(demo?.step ?? "email");
  const [email, setEmail] = useState(demo?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [loginState, loginAction, loggingIn] = useActionState(logIn, undefined);
  const [signupState, signupAction, signingUp] = useActionState(signUp, undefined);

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startCheck(async () => {
      const res = await checkEmail(email);
      if (res.error) return setError(res.error);
      setStep(res.exists ? "login" : "signup");
    });
  }

  const back = () => {
    setStep("email");
    setError(null);
  };

  const emailChip = (
    <div className="flex items-center gap-3 rounded-2xl bg-cream px-3.5 py-3">
      <Mail size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{email}</span>
      <button type="button" onClick={back} className="shrink-0 text-[13px] font-semibold text-brand">
        Change
      </button>
    </div>
  );
  // Lets password managers know which account this is
  const hiddenEmail = <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />;

  if (step === "email") {
    return (
      <form onSubmit={next} className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <IconInput
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            icon={<Mail size={19} strokeWidth={1.75} />}
          />
          <p className="mt-2 text-[13px] text-muted">We&apos;ll log you in, or help you create an account if you&apos;re new.</p>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" loading={checking} loadingText="Checking…">
          Continue
        </Button>
      </form>
    );
  }

  if (step === "login") {
    return (
      <form action={loginAction} className="space-y-5">
        <StepTitle title="Welcome back" body="Enter your password to log in." onBack={back} />
        {emailChip}
        {hiddenEmail}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className="-mt-2 text-[13px] font-semibold text-brand">
              Forgot password?
            </Link>
          </div>
          <PasswordField autoComplete="current-password" placeholder="Your password" autoFocus />
        </div>
        <FormError message={loginState?.error} />
        <Button type="submit" size="lg" loading={loggingIn} loadingText="Logging you in…">
          Log in
        </Button>
      </form>
    );
  }

  return (
    <form action={signupAction} className="space-y-5">
      <StepTitle title="Create your account" body="You're new here. Pick a password and you're in." onBack={back} />
      {emailChip}
      {hiddenEmail}
      <div>
        <Label htmlFor="password">Create a password</Label>
        <PasswordField autoComplete="new-password" placeholder="At least 8 characters" meter autoFocus />
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
      <Turnstile key={signupState?.at ?? signupState?.error ?? "first"} />
      <FormError message={signupState?.error} />
      <Button type="submit" size="lg" loading={signingUp} loadingText="Creating your account…">
        Create account
      </Button>
    </form>
  );
}

function StepTitle({ title, body, onBack }: { title: string; body: string; onBack: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <button type="button" onClick={onBack} className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-ink/5" aria-label="Back">
        <ArrowLeft size={19} />
      </button>
      <div>
        <p className="text-[18px] font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-[14px] text-muted">{body}</p>
      </div>
    </div>
  );
}
