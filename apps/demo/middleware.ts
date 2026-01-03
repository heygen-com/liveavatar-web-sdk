import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  const session = req.auth;

  // ============================================
  // MAINTENANCE MODE CHECK (highest priority)
  // ============================================
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  const maintenanceExemptPaths = [
    "/maintenance",
    "/login",
    "/api/auth",
    "/api/health",
    "/_next",
  ];
  const isExempt = maintenanceExemptPaths.some((path) =>
    pathname.startsWith(path),
  );

  if (isMaintenanceMode && !isExempt) {
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // If NOT in maintenance but trying to access /maintenance, redirect to home
  if (pathname === "/maintenance" && !isMaintenanceMode) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ============================================
  // AUTH CHECK (existing logic)
  // ============================================

  // Allow login page and auth API routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    // If already logged in and trying to access login, redirect to home
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Allow all API routes (they have their own authentication)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow home page when coming from Shopify iframe with token
  // The page will validate the token client-side via /api/shopify-customer
  if (pathname === "/" && searchParams.has("shopify_token")) {
    return NextResponse.next();
  }

  // Protect everything else - redirect to login if not authenticated
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
