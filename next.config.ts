import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

// Photos on Cloudflare R2 (when NEXT_PUBLIC_MEDIA_URL is set)
const mediaHost = process.env.NEXT_PUBLIC_MEDIA_URL ? new URL(process.env.NEXT_PUBLIC_MEDIA_URL).hostname : null;

const nextConfig: NextConfig = {
  devIndicators: false,
  // Big icebreaker imports (thousands of questions) go through a server action
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // Pages you've just been on open instantly when you go back to them (instead of waiting on the
    // server every tap). Anything you change still shows straight away: saving clears this.
    staleTimes: { dynamic: 30, static: 60 },
  },
  // Pacts are now Link-Ups at /link: older links keep working
  async redirects() {
    return [
      { source: "/pact/:path*", destination: "/link/:path*", permanent: true },
      { source: "/twin/:path*", destination: "/link/:path*", permanent: true },
      { source: "/link-up/:path*", destination: "/link/:path*", permanent: true },
      { source: "/admin/pacts", destination: "/admin/link-ups", permanent: true },
      { source: "/admin/pacts/:path*", destination: "/admin/link-ups/:path*", permanent: true },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost }, ...(mediaHost ? [{ protocol: "https" as const, hostname: mediaHost }] : [])],
  },
};

export default nextConfig;
