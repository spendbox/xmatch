import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * Servers that help two phones find each other for a call.
 * STUN works on most Wi-Fi. A TURN relay is needed on many mobile networks:
 * we use Cloudflare's (CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN).
 * Any other TURN service also works via TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL.
 */
export async function GET() {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const servers: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

  const { CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN, TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
  if (CLOUDFLARE_TURN_KEY_ID && CLOUDFLARE_TURN_API_TOKEN) {
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ttl: 4 * 60 * 60 }), // valid for 4 hours, longer than any call
          cache: "no-store",
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { iceServers: IceServer | IceServer[] };
        const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
        for (const s of list) {
          // Browsers can't use port 53, so drop those addresses
          const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u));
          if (urls.length) servers.push({ ...s, urls });
        }
      }
    } catch {
      /* fall back to STUN only */
    }
  } else if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
    servers.push({ urls: TURN_URLS.split(",").map((u) => u.trim()), username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }

  return NextResponse.json({ iceServers: servers }, { headers: { "Cache-Control": "no-store" } });
}
