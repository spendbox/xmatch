"use server";

import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resetEmail, sendEmail } from "@/lib/email";
import { verifyHuman } from "@/lib/turnstile";

export type AuthState = { error?: string; values?: Record<string, string>; at?: number } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(prev: AuthState, form: FormData): Promise<AuthState> {
  const res = await signUpInner(prev, form);
  return res ? { ...res, at: Date.now() } : res; // fresh security check after any error
}

async function signUpInner(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const values = { email };

  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", values };
  if (password.length < 8) return { error: "Your password needs at least 8 characters.", values };
  if (form.get("age_ok") !== "on") return { error: "You must be 18 or older to use Dashpad.", values };
  if (form.get("terms_ok") !== "on") return { error: "Please agree to the Terms and Privacy Policy to continue.", values };
  if (!(await verifyHuman(form.get("cf-turnstile-response")))) {
    return { error: "Please complete the security check and try again.", values, at: Date.now() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { terms_accepted_at: new Date().toISOString() } },
  });

  if (error) {
    const msg = /already registered|already been registered|already exists/i.test(error.message)
      ? "That email is already registered. Try logging in."
      : error.message;
    return { error: msg, values };
  }
  if (!data.session) {
    return {
      error: "Account created, but email confirmation is switched on in Supabase. Turn it off (see README) and log in.",
      values,
    };
  }
  redirect("/onboarding");
}

export async function logIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const values = { email };

  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", values };
  if (!password) return { error: "Please enter your password.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password.", values };
  redirect("/home");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type ResetState = { error?: string; sent?: boolean; email?: string } | undefined;

const RESET_MINUTES = 60;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function requestPasswordReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", email };
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Password reset isn't set up yet. Please email support@dashpad.site.", email };
  }
  const db = createAdminClient();
  const { data: account } = await db.from("accounts_private").select("user_id").eq("email", email).maybeSingle();

  // Always say "sent", so nobody can use this to find out who has an account
  if (account) {
    const userId = account.user_id as string;
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await db.from("password_resets").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("created_at", since);
    if ((count ?? 0) < 3) {
      const token = crypto.randomBytes(32).toString("base64url");
      await db.from("password_resets").insert({
        user_id: userId,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
      });
      const { data: profile } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site";
      const mail = resetEmail(`${site}/reset-password?token=${token}`, profile?.display_name);
      try {
        await sendEmail({ to: email, ...mail });
      } catch (e) {
        console.error("Reset email failed", e);
        return { error: "We couldn't send the email right now. Please try again in a few minutes.", email };
      }
    }
  }
  return { sent: true, email };
}

export async function setNewPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };
  if (!token) return { error: "This reset link is not valid. Please request a new one." };

  const db = createAdminClient();
  const { data: reset } = await db
    .from("password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    return { error: "This reset link has expired or was already used. Please request a new one." };
  }

  const { data: updated, error } = await db.auth.admin.updateUserById(reset.user_id, { password });
  if (error || !updated.user?.email) return { error: "Couldn't update your password. Please try again." };

  // Use this link up, and cancel any other open ones
  await db.from("password_resets").update({ used_at: new Date().toISOString() }).eq("user_id", reset.user_id).is("used_at", null);

  // Log them straight in
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: updated.user.email, password });
  redirect("/home");
}
