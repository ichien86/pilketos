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

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

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

// Hanya berlaku untuk route API
export const config = {
  matcher: "/api/:path*",
};
