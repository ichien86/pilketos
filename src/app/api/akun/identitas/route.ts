import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import type { PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// Nama pemilih sendiri, dibaca read-only dari pemilih_dpt -- dipakai untuk
// sapaan "Selamat datang, <nama>" di dashboard /pemilih. Mode-aware
// (resolveAppMode()) supaya pemilih di sandbox uji coba tidak salah baca
// data produksi atau sebaliknya.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims || claims.role !== "pemilih" || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 401);
  }
  const db = await getDb(await resolveAppMode());
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: claims.pemilihId });
  return NextResponse.json({ nama: pemilih?.nama ?? null });
}
