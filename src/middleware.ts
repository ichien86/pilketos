import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Global API Rate Limiter — ramah jaringan NAT sekolah (maks 1.800 req/menit per IP)
// ---------------------------------------------------------------------------

const GLOBAL_LIMIT = 1800; // max requests (~30 req/detik per IP publik)
const GLOBAL_WINDOW = 60; // per 60 detik

// Endpoint polling frekuensi tinggi yang aman dibypass dari limit ketat
const BYPASS_PREFIXES = [
  "/api/checkin/status",
  "/api/fase",
  "/api/hasil",
  "/api/panitia/bilik-monitor",
  "/api/admin/rekonsiliasi",
  "/api/uploads",
];

const COOKIE_SESSION_NAME = "pilketos_session";

// Halaman-halaman internal yang memerlukan sesi aktif
const PROTECTED_PAGE_PREFIXES = [
  "/pemilih",
  "/admin",
  "/panitia",
  "/kandidat",
  "/pengawas",
  "/ganti-password",
];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1. Penanganan Route API: Rate limiting global
  if (pathname.startsWith("/api/")) {
    // Bypass rute polling berkala dan file statis agar tidak memblokir NAT sekolah
    if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.next();
    }

    const ip = getClientIp(req);
    const result = checkRateLimit(`global:${ip}`, GLOBAL_LIMIT, GLOBAL_WINDOW);

    if (result.limited) {
      return NextResponse.json(
        { error: "Terlalu banyak request. Silakan tunggu sebentar." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter),
          },
        }
      );
    }

    return NextResponse.next();
  }

  // 2. Penanganan Halaman Bilik Suara: Dikecualikan karena menggunakan voteToken anonim
  if (pathname === "/pemilih/bilik") {
    return NextResponse.next();
  }

  // 3. Penanganan Halaman Internal: Pastikan cookie sesi tersedia
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (isProtectedPage) {
    const sessionCookie = req.cookies.get(COOKIE_SESSION_NAME)?.value;
    if (!sessionCookie || !sessionCookie.trim()) {
      const loginUrl = new URL("/?expired=1", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Berlaku untuk API dan seluruh halaman internal
export const config = {
  matcher: [
    "/api/:path*",
    "/pemilih",
    "/pemilih/:path*",
    "/admin",
    "/admin/:path*",
    "/panitia",
    "/panitia/:path*",
    "/kandidat",
    "/kandidat/:path*",
    "/pengawas",
    "/pengawas/:path*",
    "/ganti-password",
    "/ganti-password/:path*",
  ],
};
