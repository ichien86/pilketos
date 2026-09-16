import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint ringan untuk Fly.io load balancer.
 * Merespons status 200 OK secara instan (< 2ms) tanpa beban komputasi/SSR.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
