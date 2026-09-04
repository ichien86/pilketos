import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { hitungLolosSyarat } from "@/lib/eligibility";
import type { AkunPengguna, PemilihDpt, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

function checkinSecret(): string {
  const s = process.env.SECRET_CHECKIN;
  if (!s) throw new Error("SECRET_CHECKIN belum diset");
  return s;
}

// Bagian 3 langkah 1 -- scan barcode identitas. HANYA menampilkan data ke
// layar panitia untuk dicocokkan manual dengan dokumen fisik; TIDAK mengubah
// status apa pun (ACC adalah aksi terpisah, lihat /acc).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const qrPayload = typeof body?.qrPayload === "string" ? body.qrPayload : "";
  if (!qrPayload) return errorJson("qrPayload wajib diisi", 400);

  let pemilihId: string;
  try {
    const decoded = jwt.verify(qrPayload, checkinSecret()) as { pemilihId: string };
    pemilihId = decoded.pemilihId;
  } catch {
    return errorJson("Barcode tidak valid atau sudah kedaluwarsa -- minta pemilih refresh barcode", 400);
  }

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: pemilihId });
  if (!pemilih) return errorJson("Data pemilih tidak ditemukan", 404);

  const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ pemilih_id: pemilihId });
  const lolosSyarat = await hitungLolosSyarat(db, pemilihId, akun);

  const sesiAktifSebelumnya = await db.collection<SesiPemilih>("sesi_pemilih").findOne({
    pemilih_id: pemilihId,
    status: { $in: ["menunggu", "di_bilik", "sudah_memilih", "selesai"] },
  });

  return NextResponse.json({
    nama: pemilih.nama,
    nis_nip: pemilih.nis_nip,
    tanggal_lahir: pemilih.tanggal_lahir,
    jenis: pemilih.jenis,
    kelas_atau_pangkat: pemilih.kelas ?? pemilih.pangkat,
    foto_referensi: pemilih.foto_kartu_pelajar,
    bukti_jenis: pemilih.bukti_jenis === "Lainnya" ? pemilih.bukti_jenis_lainnya : pemilih.bukti_jenis,
    bukti_nomor: pemilih.bukti_nomor,
    lolosSyarat,
    sudahPunyaSesiHariIni: !!sesiAktifSebelumnya,
    pemilihId,
  });
}
