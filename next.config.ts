import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Big icebreaker imports (thousands of questions) go through a server action
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Pacts are now called Twin: old links keep working
  async redirects() {
    return [{ source: "/pact/:path*", destination: "/twin/:path*", permanent: true }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost }],
  },
};

export default nextConfig;
