import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase } from "@/lib/fase-gate";
import type { Kandidat, ProgressPemilih } from "@/types";

export const dynamic = "force-dynamic";

// US-12 -- daftar paslon terkunci sejak sosialisasi dibuka, dengan status
// sudah/belum ditonton per pemilih.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"]) || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 403);
  }

  const faseSosialisasi = await getFase("sosialisasi");
  const kandidatTerkunci = faseSosialisasi.kandidat_terkunci ?? [];

  const db = await getDb("prod");
  const [kandidatList, progress] = await Promise.all([
    db.collection<Kandidat>("kandidat").find({ _id: { $in: kandidatTerkunci } }).toArray(),
    db.collection<ProgressPemilih>("progress_pemilih").findOne({ pemilih_id: claims.pemilihId }),
  ]);
  const ditonton = new Set(progress?.video_ditonton ?? []);

  // Pembatalan (US-08) tetap mengecualikan kandidat itu dari daftar, walau
  // sudah terkunci -- kandidat_terkunci hanya membekukan ID, bukan status.
  const daftar = kandidatList
    .filter((k) => k.status !== "dibatalkan")
    .map((k) => ({
      kandidat_id: k._id,
      nomor_urut: k.nomor_urut,
      nama_ketua: k.nama_ketua,
      nama_wakil: k.nama_wakil,
      sudah_ditonton: ditonton.has(k._id),
    }));

  return NextResponse.json({
    total: daftar.length,
    sudah_ditonton: daftar.filter((d) => d.sudah_ditonton).length,
    daftar,
  });
}
