import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Global API Rate Limiter — maks 120 request/menit per IP
// ---------------------------------------------------------------------------

const GLOBAL_LIMIT = 120; // max requests
const GLOBAL_WINDOW = 60; // per 60 detik

export function middleware(req: NextRequest) {
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
