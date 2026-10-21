import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * Servers that help two phones find each other for a call.
 * STUN works for most home Wi-Fi. A TURN relay is needed on many mobile
 * networks — set one up with Metered (METERED_DOMAIN + METERED_API_KEY)
 * or any TURN service (TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL).
 */
export async function GET() {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const servers: IceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];

  const { METERED_DOMAIN, METERED_API_KEY, TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
  if (METERED_DOMAIN && METERED_API_KEY) {
    try {
      const res = await fetch(`https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`, { cache: "no-store" });
      if (res.ok) servers.push(...((await res.json()) as IceServer[]));
    } catch {
      /* fall back to STUN only */
    }
  } else if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
    servers.push({ urls: TURN_URLS.split(",").map((u) => u.trim()), username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }

  return NextResponse.json({ iceServers: servers }, { headers: { "Cache-Control": "no-store" } });
}
