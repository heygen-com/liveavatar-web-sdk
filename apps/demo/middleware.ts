import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // ============================================
  // MAINTENANCE MODE CHECK (highest priority)
  // ============================================
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  // DEBUG: Log maintenance mode status
  console.log("🔍 MAINTENANCE DEBUG:", {
    pathname,
    MAINTENANCE_MODE_RAW: process.env.MAINTENANCE_MODE,
    isMaintenanceMode,
  });

  // CRITICAL: /login and /api/auth must be exempt from maintenance mode
  // to prevent infinite redirect loop:
  // 1. User visits / → redirects to /maintenance (MAINTENANCE_MODE=true)
  // 2. /maintenance requires auth → redirects to /login
  // 3. /login not exempt → redirects to /maintenance
  // 4. LOOP ♾️
  const maintenanceExemptPaths = [
    "/maintenance",
    "/login", // Prevents loop (user can access login page)
    "/api/auth", // Prevents loop (NextAuth callbacks work)
    "/api/health",
    "/_next",
    "/favicon.ico",
  ];
  const isExempt = maintenanceExemptPaths.some((path) =>
    pathname.startsWith(path),
  );

  if (isMaintenanceMode && !isExempt) {
    console.log("🚨 REDIRECTING TO MAINTENANCE:", { pathname, isExempt });
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // If NOT in maintenance but trying to access /maintenance, redirect to home
  if (pathname === "/maintenance" && !isMaintenanceMode) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ============================================
  // AUTH CHECK (existing logic)
  // ============================================

  // Allow public pages (login, maintenance, auth)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/maintenance")
  ) {
    // If already logged in and trying to access login, redirect to home
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
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
