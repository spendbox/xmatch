import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only run the login check on pages that need it (app pages, login pages and
// the landing page). Everything else — API routes, legal pages, admin, images —
// skips it, which saves a round trip on every request.
export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/home/:path*",
    "/events/:path*",
    "/feed/:path*",
    "/masquerade/:path*",
    "/matches/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/wallet/:path*",
    "/link/:path*",
  ],
};
