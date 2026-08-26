import { NextRequest, NextResponse } from "next/server";
import { getDb, type DbMode } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { PemilihDpt, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// Rincian di balik angka "Token terbit" di /admin/rekonsiliasi -- SIAPA yang
// sudah di-ACC dan status sesinya sejauh apa. SENGAJA TIDAK PERNAH
// menyertakan token_hash/barcode_bukti/kandidat_dipilih_nomor -- token itu
// sendiri adalah kredensial (siapa pun yang pegang bisa memilih atas nama
// orang itu), dan kandidat pilihan harus tetap anonim sesuai US-17. Yang
// boleh dilihat cuma identitas + status PROSES-nya (bukan pilihannya).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  const modeParam = req.nextUrl.searchParams.get("mode");
  const mode: DbMode = modeParam === "simulasi" ? "simulasi" : "prod";

  const db = await getDb(mode);
  const sesiList = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .find(
      {},
      { projection: { pemilih_id: 1, status: 1, antre_at: 1, masuk_bilik_at: 1, selesai_at: 1, barcode_used_at: 1 } }
    )
    .sort({ antre_at: -1 })
    .toArray();

  const pemilihList = await db
    .collection<PemilihDpt>("pemilih_dpt")
    .find(
      { _id: { $in: sesiList.map((s) => s.pemilih_id) } },
      { projection: { nama: 1, nis_nip: 1, jenis: 1, kelas: 1, pangkat: 1 } }
    )
    .toArray();
  const pemilihById = new Map(pemilihList.map((p) => [p._id, p]));

  const daftar = sesiList.map((s) => {
    const pemilih = pemilihById.get(s.pemilih_id);
    return {
      nama: pemilih?.nama ?? "(data pemilih tidak ditemukan)",
      nis_nip: pemilih?.nis_nip ?? "-",
      kelas_atau_pangkat: pemilih ? (pemilih.jenis === "siswa" ? pemilih.kelas : pemilih.pangkat) : null,
      status: s.status,
      antre_at: s.antre_at,
      sudah_scan_keluar: !!s.barcode_used_at,
    };
  });

  return NextResponse.json({ mode, daftar });
}
