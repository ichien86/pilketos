import { NextRequest, NextResponse } from "next/server";
import { getDb, type DbMode } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { SesiPemilih, KontrolFase } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  const modeParam = req.nextUrl.searchParams.get("mode");
  const mode: DbMode = modeParam === "simulasi" ? "simulasi" : "prod";

  const db = await getDb(mode);
  
  const kontrol = await db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: "pemilihan" });
  if (!kontrol?.hasil_diumumkan) {
    return errorJson("Hasil belum diumumkan", 403);
  }

  const sesiList = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .find(
      { status: { $in: ["sudah_memilih", "selesai"] } },
      { projection: { barcode_bukti_plain: 1, kandidat_dipilih_nomor: 1, selesai_at: 1 } }
    )
    .sort({ selesai_at: -1 })
    .toArray();

  const daftar = sesiList.map((s) => ({
    token: s.barcode_bukti_plain,
    pilihan: s.kandidat_dipilih_nomor === 0 ? "Abstain" : `Paslon ${s.kandidat_dipilih_nomor}`,
    waktu: s.selesai_at,
  }));

  return NextResponse.json({ mode, daftar });
}
