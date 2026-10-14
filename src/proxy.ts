import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdminAuthorization, isAdminConfigured } from "@/lib/admin-auth";

// Gate every /admin route behind HTTP Basic auth.
// Admin server actions re-check this (see requireAdmin) since actions can be
// invoked by POSTing to any path.
export function proxy(request: NextRequest) {
  if (!isAdminConfigured()) {
    // No login prompt: no password could ever pass, so say what's wrong instead.
    console.error("Admin login is disabled: ADMIN_USERNAME and/or ADMIN_PASSWORD is not set.");
    return new NextResponse(
      "Admin login isn't set up yet. Add ADMIN_USERNAME and ADMIN_PASSWORD in your hosting settings " +
        "(Vercel: Settings → Environment Variables, for Production), then redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  if (isAdminAuthorization(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": ADMIN_REALM },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
