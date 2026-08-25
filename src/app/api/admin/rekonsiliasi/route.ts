import { NextRequest, NextResponse } from "next/server";
import { getDb, type DbMode } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { Kandidat, SesiPemilih, Suara } from "@/types";

export const dynamic = "force-dynamic";

// US-17 -- rekap agregat, TIDAK PERNAH baris data yang menghubungkan
// identitas dengan pilihan. Angka gabungan siswa+guru tanpa pemisahan.
//
// mode dipilih lewat query param (default "prod"), BUKAN resolveHariHMode(),
// karena rekonsiliasi justru paling dibutuhkan SETELAH fase pemilihan
// ditutup -- resolveHariHMode() sengaja melempar error saat tidak ada fase
// hari-H yang aktif, jadi tidak cocok dipakai di sini.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  const modeParam = req.nextUrl.searchParams.get("mode");
  const mode: DbMode = modeParam === "simulasi" ? "simulasi" : "prod";

  const db = await getDb(mode);
  const [totalTokenTerbit, totalSudahMemilih, totalScanKeluar, totalSuara, perPaslonAgg, kandidatList] =
    await Promise.all([
      db.collection<SesiPemilih>("sesi_pemilih").countDocuments({}),
      db.collection<SesiPemilih>("sesi_pemilih").countDocuments({
        status: { $in: ["sudah_memilih", "selesai"] },
      }),
      db.collection<SesiPemilih>("sesi_pemilih").countDocuments({ barcode_used_at: { $ne: null } }),
      db.collection<Suara>("suara").countDocuments({}),
      db
        .collection<Suara>("suara")
        .aggregate<{ _id: string; jumlah: number }>([
          { $group: { _id: "$kandidat_id", jumlah: { $sum: 1 } } },
        ])
        .toArray(),
      db.collection<Kandidat>("kandidat").find({}).toArray(),
    ]);

  const kandidatById = new Map(kandidatList.map((k) => [k._id, k]));
  const perPaslon = perPaslonAgg.map((p) => ({
    kandidat_id: p._id,
    nomor_urut: kandidatById.get(p._id)?.nomor_urut ?? null,
    nama: kandidatById.get(p._id)
      ? `${kandidatById.get(p._id)!.nama_ketua} & ${kandidatById.get(p._id)!.nama_wakil}`
      : "(kandidat tidak ditemukan)",
    jumlah_suara: p.jumlah,
  }));

  const perluInvestigasi = totalSudahMemilih !== totalSuara;

  return NextResponse.json({
    mode,
    total_token_terbit: totalTokenTerbit,
    total_sudah_memilih: totalSudahMemilih,
    total_scan_keluar: totalScanKeluar,
    total_suara: totalSuara,
    per_paslon: perPaslon,
    perlu_investigasi: perluInvestigasi,
  });
}
