"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export type AuthState = { error?: string; values?: Record<string, string> } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const rawPhone = String(form.get("phone") ?? "");
  const password = String(form.get("password") ?? "");
  const values = { email, phone: rawPhone };

  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", values };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Please enter a valid phone number, e.g. +234 801 234 5678.", values };
  if (password.length < 8) return { error: "Your password needs at least 8 characters.", values };
  if (form.get("age_ok") !== "on") return { error: "You must be 18 or older to use Dashpad.", values };

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data: existing } = await admin.rpc("email_for_phone", { p_phone: phone });
    if (existing) return { error: "That phone number is already registered. Try logging in.", values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone } },
  });

  if (error) {
    const msg = /already registered|already been registered/i.test(error.message)
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
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { identifier };

  if (!identifier || !password) return { error: "Enter your email or phone and your password.", values };

  let email = identifier.toLowerCase();
  if (!identifier.includes("@")) {
    const phone = normalizePhone(identifier);
    if (!phone) return { error: "That doesn't look like an email or phone number.", values };
    const admin = createAdminClient();
    const { data } = await admin.rpc("email_for_phone", { p_phone: phone });
    if (!data) return { error: "Wrong phone number or password.", values };
    email = data as string;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong login details or password.", values };
  redirect("/masquerade");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
