"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export type AuthState = { error?: string; values?: Record<string, string> } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const values = { email };

  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", values };
  if (password.length < 8) return { error: "Your password needs at least 8 characters.", values };
  if (form.get("age_ok") !== "on") return { error: "You must be 18 or older to use Dashpad.", values };
  if (form.get("terms_ok") !== "on") return { error: "Please agree to the Terms and Privacy Policy to continue.", values };

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
  const method = form.get("method") === "phone" ? "phone" : "email";
  const password = String(form.get("password") ?? "");
  let email = String(form.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(form.get("phone") ?? "");
  const values = { method, email };

  if (!password) return { error: "Please enter your password.", values };

  if (method === "phone") {
    const phone = normalizePhone(phoneRaw);
    if (!phone) return { error: "Please enter a valid phone number.", values };
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Phone log-in isn't set up yet. Use your email.", values };
    const { data } = await createAdminClient().rpc("email_for_phone", { p_phone: phone });
    if (!data) return { error: "Wrong phone number or password.", values };
    email = data as string;
  } else if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: method === "phone" ? "Wrong phone number or password." : "Wrong email or password.", values };
  redirect("/masquerade");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type ResetState = { error?: string; sent?: boolean; email?: string } | undefined;

export async function requestPasswordReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", email };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site";
  const supabase = await createClient();
  // Always say "sent" so nobody can use this to check who has an account
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/reset-password` });
  return { sent: true, email };
}

export async function setNewPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "That link has expired. Please request a new one." };
  redirect("/masquerade");
}
