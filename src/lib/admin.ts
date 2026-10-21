import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Admin login uses ADMIN_EMAIL and ADMIN_PASSWORD from Vercel's environment variables.
// Changing either one in Vercel logs every admin out.

const COOKIE = "dp_admin";
const DAYS = 7;

function secret() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  return crypto.createHash("sha256").update(`${process.env.ADMIN_SESSION_SECRET ?? ""}|${email.toLowerCase()}|${password}`).digest();
}

function sign(value: string, key: Buffer) {
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function adminConfigured() {
  return !!secret();
}

export function checkAdminLogin(email: string, password: string) {
  const e = process.env.ADMIN_EMAIL;
  const p = process.env.ADMIN_PASSWORD;
  if (!e || !p) return false;
  // Compare both even if the first fails, so timing doesn't leak which was wrong
  const okEmail = same(email.trim().toLowerCase(), e.trim().toLowerCase());
  const okPass = same(password, p);
  return okEmail && okPass;
}

export async function startAdminSession() {
  const key = secret();
  if (!key) return;
  const expires = Date.now() + DAYS * 86400_000;
  const value = `${expires}.${sign(String(expires), key)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  // Read the cookie first so pages using this are always checked per request
  const raw = (await cookies()).get(COOKIE)?.value;
  const key = secret();
  if (!key) return false;
  if (!raw) return false;
  const [expires, sig] = raw.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return same(sig, sign(expires, key));
}

/** Use at the top of every admin page and admin action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
