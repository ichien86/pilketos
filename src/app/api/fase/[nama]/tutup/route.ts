import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { hitungPemilihBelumAktivasi, hitungPemilihBelumSosialisasi } from "@/lib/eligibility";
import type { KontrolFase, StatusFase } from "@/types";
import { URUTAN_FASE } from "@/types";

export const dynamic = "force-dynamic";

// US-18 -- tutup fase. Menutup "pendataan" mengunci endpoint aktivasi (US-05).
// Ditulis ke database mode yang sedang aktif (produksi atau sandbox uji
// coba) -- lihat resolveAppMode(). Mematikan mode uji coba itu sendiri
// (yang mereset SEMUA fase sekaligus) ada di /api/mode/uji-coba, terpisah
// dari menutup satu fase seperti di sini.
export async function POST(
  req: NextRequest,
  { params }: { params: { nama: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const nama = params.nama as StatusFase;
  if (!URUTAN_FASE.includes(nama)) return errorJson("Nama fase tidak dikenal", 400);

  const fase = await getFase(nama);
  if (fase.status !== "aktif") return errorJson("Fase ini sedang tidak aktif", 409);

  const db = await getDb(await resolveAppMode());

  // Gerbang tambahan, TIDAK ADA PENGECUALIAN: pendataan tidak bisa ditutup
  // selagi masih ada pemilih di DPT yang belum aktivasi; sosialisasi tidak
  // bisa ditutup selagi masih ada yang belum menonton semua video kandidat
  // wajib. Dicek di sini (bukan cuma ditampilkan di /admin/dpt) supaya
  // benar-benar menegakkan, bukan cuma informasi.
  if (nama === "pendataan") {
    const { total, belum } = await hitungPemilihBelumAktivasi(db);
    if (belum > 0) {
      return errorJson(
        `Masih ada ${belum} dari ${total} pemilih yang belum mengaktivasi akunnya -- pendataan tidak bisa ditutup sebelum semua aktivasi selesai, tidak ada pengecualian.`,
        409
      );
    }
  }
  if (nama === "sosialisasi") {
    const { total, belum } = await hitungPemilihBelumSosialisasi(db);
    if (belum > 0) {
      return errorJson(
        `Masih ada ${belum} dari ${total} pemilih yang belum menonton semua video sosialisasi -- sosialisasi tidak bisa ditutup sebelum semua selesai, tidak ada pengecualian.`,
        409
      );
    }
  }

  await db.collection<KontrolFase>("kontrol_fase").updateOne(
    { nama_fase: nama },
    { $set: { status: "ditutup", ditutup_at: new Date() } }
  );

  const updated = await db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: nama });
  return NextResponse.json(updated);
}
