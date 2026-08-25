import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// US-08 -- batalkan kandidat yang sudah aktif (mis. mengundurkan diri).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb(await resolveAppMode());
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);
  if (kandidat.status !== "aktif") {
    return errorJson("Hanya kandidat berstatus aktif yang bisa dibatalkan", 409);
  }

  const now = new Date();
  await db.collection<Kandidat>("kandidat").updateOne(
    { _id: params.id },
    { $set: { status: "dibatalkan", dibatalkan_at: now, updated_at: now } }
  );
  const updated = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  return NextResponse.json(updated);
}
