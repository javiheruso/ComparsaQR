import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/access";

const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/admin-status",
  "/api/auth/bootstrap-admin",
  "/api/auth/logout",
  "/api/scanner-auth/login",
  "/api/heartbeat",
  "/scanner",
  "/_next",
  "/favicon.ico",
  "/manifest.json",
  "/",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const session = await getSession();
  const isAdmin = canAccessAdmin(session);
  const isAuthenticated = Boolean(session.actorType || session.isLoggedIn || session.scannerVerified);

  if (!isAuthenticated) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
