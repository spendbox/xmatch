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
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  // Asked twice if Cloudflare can't be reached the first time, so a blip doesn't fail a real person
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
      if (res.status >= 500) continue;
      const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
      // Why a check failed shows up in the Vercel logs
      if (!data.success) console.warn("Turnstile check failed:", (data["error-codes"] ?? []).join(", ") || "no reason given");
      return !!data.success;
    } catch {
      // Couldn't reach Cloudflare: try once more
    }
  }
  return false;
}
