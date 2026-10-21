"use server";

import { redirect } from "next/navigation";
import { checkAdminLogin, endAdminSession, startAdminSession } from "@/lib/admin";
import { verifyHuman } from "@/lib/turnstile";

export type AdminLoginState = { error?: string; at?: number } | undefined;

export async function adminLogin(_: AdminLoginState, form: FormData): Promise<AdminLoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!(await verifyHuman(form.get("cf-turnstile-response")))) {
    return { error: "Please complete the security check.", at: Date.now() };
  }
  // A short pause makes password guessing slow
  await new Promise((r) => setTimeout(r, 600));
  if (!checkAdminLogin(email, password)) return { error: "Wrong admin email or password.", at: Date.now() };
  await startAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await endAdminSession();
  redirect("/admin/login");
}
