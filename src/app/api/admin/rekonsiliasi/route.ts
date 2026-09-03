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
  const [
    totalTokenTerbit,
    totalSudahMemilih,
    totalScanKeluar,
    totalSuara,
    totalKedaluwarsa,
    totalSedangProses,
    perPaslonAgg,
    kandidatList,
  ] = await Promise.all([
    db.collection<SesiPemilih>("sesi_pemilih").countDocuments({}),
    db.collection<SesiPemilih>("sesi_pemilih").countDocuments({
      status: { $in: ["sudah_memilih", "selesai"] },
    }),
    db.collection<SesiPemilih>("sesi_pemilih").countDocuments({ barcode_used_at: { $ne: null } }),
    db.collection<Suara>("suara").countDocuments({}),
    db.collection<SesiPemilih>("sesi_pemilih").countDocuments({ status: "kedaluwarsa" }),
    db.collection<SesiPemilih>("sesi_pemilih").countDocuments({
      status: { $in: ["menunggu", "di_bilik"] },
    }),
    db
      .collection<Suara>("suara")
      .aggregate<{ _id: string; jumlah: number }>([
        { $group: { _id: "$kandidat_id", jumlah: { $sum: 1 } } },
      ])
      .toArray(),
    db.collection<Kandidat>("kandidat").find({}).toArray(),
  ]);

  const kandidatById = new Map(kandidatList.map((k) => [k._id, k]));
  const perPaslon = perPaslonAgg.map((p) => {
    if (p._id === "abstain") {
      return {
        kandidat_id: "abstain",
        nomor_urut: 0,
        nama: "Abstain / Suara Kosong",
        jumlah_suara: p.jumlah,
      };
    }
    const k = kandidatById.get(p._id);
    return {
      kandidat_id: p._id,
      nomor_urut: k?.nomor_urut ?? null,
      nama: k ? `${k.nama_ketua} & ${k.nama_wakil}` : "(kandidat tidak ditemukan)",
      jumlah_suara: p.jumlah,
    };
  });

  // Urutkan nomor urut paslon, dan abstain di akhir
  perPaslon.sort((a, b) => {
    if (a.nomor_urut === 0) return 1;
    if (b.nomor_urut === 0) return -1;
    return (a.nomor_urut ?? 99) - (b.nomor_urut ?? 99);
  });

  const perluInvestigasi = totalSudahMemilih !== totalSuara;

  const kontrol = await db.collection("kontrol_fase").findOne({ nama_fase: "pemilihan" });
  const hasilDiumumkan = kontrol?.hasil_diumumkan === true;

  return NextResponse.json({
    mode,
    total_token_terbit: totalTokenTerbit,
    total_sudah_memilih: totalSudahMemilih,
    total_scan_keluar: totalScanKeluar,
    total_suara: totalSuara,
    total_kedaluwarsa: totalKedaluwarsa,
    total_sedang_proses: totalSedangProses,
    per_paslon: hasilDiumumkan ? perPaslon : [],
    perlu_investigasi: perluInvestigasi,
  });
}
