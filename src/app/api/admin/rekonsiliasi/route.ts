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

  const nonDibatalkanList = kandidatList
    .filter((k) => k.status !== "dibatalkan")
    .sort((a, b) => (a.nomor_urut ?? 99) - (b.nomor_urut ?? 99));
  const labelAbstain = nonDibatalkanList.length === 1 ? "Kotak Kosong" : "Tidak Memilih";

  const jumlahByKandidat = new Map(perPaslonAgg.map((p) => [p._id, p.jumlah]));

  // Seluruh paslon yang sah/aktif HARUS selalu tampil dalam rekapitulasi,
  // meskipun perolehan suaranya masih 0 (bukan menghilang dari daftar).
  const perPaslon = nonDibatalkanList.map((k) => ({
    kandidat_id: k._id,
    nomor_urut: k.nomor_urut ?? null,
    nama: `${k.nama_ketua} & ${k.nama_wakil}`,
    jumlah_suara: jumlahByKandidat.get(k._id) ?? 0,
  }));

  // Masukkan opsi abstain jika ada suara tidak memilih atau jika calon tunggal
  const jumlahAbstain = jumlahByKandidat.get("abstain") ?? 0;
  if (jumlahAbstain > 0 || nonDibatalkanList.length === 1) {
    perPaslon.push({
      kandidat_id: "abstain",
      nomor_urut: 0,
      nama: labelAbstain,
      jumlah_suara: jumlahAbstain,
    });
  }

  // Urutkan nomor urut paslon, dan letakkan abstain di akhir
  perPaslon.sort((a, b) => {
    if (a.nomor_urut === 0) return 1;
    if (b.nomor_urut === 0) return -1;
    return (a.nomor_urut ?? 99) - (b.nomor_urut ?? 99);
  });

  const perluInvestigasi = totalSudahMemilih !== totalSuara;

  const kontrol = await db.collection("kontrol_fase").findOne({ nama_fase: "pemilihan" });
  const hasilDiumumkan = kontrol?.hasil_diumumkan === true;

  let alasanAbstainList: string[] = [];
  if (hasilDiumumkan) {
    const alasanDocs = await db
      .collection<Suara>("suara")
      .find({ kandidat_id: "abstain", alasan_abstain: { $ne: null } }, { projection: { alasan_abstain: 1 } })
      .toArray();
    alasanAbstainList = alasanDocs.map((s) => s.alasan_abstain!).filter(Boolean);
  }

  return NextResponse.json({
    mode,
    total_token_terbit: totalTokenTerbit,
    total_sudah_memilih: totalSudahMemilih,
    total_scan_keluar: totalScanKeluar,
    total_suara: totalSuara,
    total_kedaluwarsa: totalKedaluwarsa,
    total_sedang_proses: totalSedangProses,
    per_paslon: hasilDiumumkan ? perPaslon : [],
    alasan_abstain_list: alasanAbstainList,
    perlu_investigasi: perluInvestigasi,
  });
}
