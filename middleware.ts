import { NextRequest, NextResponse } from "next/server";

// Routes that are only valid when running inside the Electron desktop app (localhost).
// Any request to these paths from a non-localhost origin is redirected to the marketing site.
const DESKTOP_ONLY_PREFIXES = [
  "/attorney",
  "/setup",
  "/api/attorney",
  "/api/setup",
  "/api/chat",
  "/api/hygiene",
  "/api/conversations",
  "/api/documents",
  "/api/enclave",
  "/admin",
  "/api/admin",
];

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (!isLocalhost) {
    const pathname = request.nextUrl.pathname;
    const isDesktopOnly = DESKTOP_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isDesktopOnly) {
      return NextResponse.redirect("https://mizan.legal", { status: 301 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/attorney/:path*",
    "/setup",
    "/admin/:path*",
    "/api/attorney/:path*",
    "/api/setup/:path*",
    "/api/chat/:path*",
    "/api/hygiene",
    "/api/conversations/:path*",
    "/api/documents/:path*",
    "/api/enclave/:path*",
    "/api/admin/:path*",
  ],
};
