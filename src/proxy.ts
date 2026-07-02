import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/admin/login",
  "/api/auth",
  "/api/scanner-auth",
  "/api/heartbeat",
  "/scanner",
  "/_next",
  "/favicon.ico",
  "/manifest.json",
  "/",
];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("comparsa_admin_session");

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // Protect admin routes - check cookie exists and has meaningful length
  if (pathname.startsWith("/admin")) {
    if (!sessionCookie?.value || sessionCookie.value.length < 20) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect API routes (except public ones)
  if (pathname.startsWith("/api")) {
    if (!sessionCookie?.value || sessionCookie.value.length < 20) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
