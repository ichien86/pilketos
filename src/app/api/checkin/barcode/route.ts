import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { CHECKIN_BARCODE_TTL_MS } from "@/types";

export const dynamic = "force-dynamic";

function checkinSecret(): string {
  const s = process.env.SECRET_CHECKIN;
  if (!s) throw new Error("SECRET_CHECKIN belum diset");
  return s;
}

// Bagian 2 dok. teknis v6 -- barcode identitas dari SESI LOGIN, bukan token vote.
// Tidak membawa info prasyarat lolos/tidak; itu divalidasi ulang di server saat
// panitia scan (Bagian 3), bukan dipercaya dari klien.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"]) || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 401);
  }

  const payload = { pemilihId: claims.pemilihId };
  const signed = jwt.sign(payload, checkinSecret(), {
    expiresIn: Math.floor(CHECKIN_BARCODE_TTL_MS / 1000),
  });
  return NextResponse.json({ qrPayload: signed, ttlMs: CHECKIN_BARCODE_TTL_MS });
}
