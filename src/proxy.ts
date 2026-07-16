import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/scanner-auth",
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
  const isAuthenticated = session.isLoggedIn || session.scannerVerified;

  if (!isAuthenticated) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
