import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, ...claims });
}
