import "server-only";
import { headers } from "next/headers";

/**
 * Checks Cloudflare Turnstile (bot protection).
 * If no secret key is set (e.g. while testing locally) it lets everyone through.
 */
export async function verifyHuman(token: FormDataEntryValue | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || typeof token !== "string") return false;
  const ip = (await headers()).get("cf-connecting-ip") ?? (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
