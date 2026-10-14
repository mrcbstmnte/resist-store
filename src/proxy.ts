import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, adminConfigError, isAdminAuthorization } from "@/lib/admin-auth";

// Gate every /admin route behind HTTP Basic auth.
// Admin server actions re-check this (see requireAdmin) since actions can be
// invoked by POSTing to any path.
export function proxy(request: NextRequest) {
  const configError = adminConfigError();
  if (configError) {
    // No login prompt: no password could ever pass, so say what's wrong instead.
    console.error(`Admin login is disabled: ${configError}`);
    return new NextResponse(
      `Admin login isn't set up correctly: ${configError}\n\n` +
        "Fix ADMIN_USERNAME and ADMIN_PASSWORD in your hosting settings (Vercel: Settings → Environment Variables, " +
        "for Production), then redeploy. For several admins, separate them with commas in the same order, " +
        'e.g. ADMIN_USERNAME="ana,ben" and ADMIN_PASSWORD="ana-password,ben-password".',
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
