import { NextResponse } from "next/server";

// Invite links: dashpad.site/i/CODE. Remember the code for 30 days, then show the landing page.
// The code is claimed once the new member finishes setting up their profile.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
  const res = NextResponse.redirect(new URL("/", req.url));
  if (clean) res.cookies.set("dp_ref", clean, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  return res;
}
