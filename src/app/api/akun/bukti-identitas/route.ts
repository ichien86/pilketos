import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import { validasiBuktiIdentitas } from "@/lib/bukti-identitas";
import type { PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// Bukti diri yang dijanjikan pemilih untuk dibawa ke TPS hari-H. Diisi wajib
// saat aktivasi (lihat akun/aktivasi); endpoint ini memungkinkan pemilih
// mengubahnya sendiri kapan saja sesudahnya, termasuk saat hari-H sebelum
// check-in -- lihat dashboard /pemilih yang menampilkan pesan pengingat +
// menu ubah ini.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb(await resolveAppMode());
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: claims!.pemilihId! });
  if (!pemilih) return errorJson("Data pemilih tidak ditemukan", 404);

  return NextResponse.json({
    bukti_jenis: pemilih.bukti_jenis,
    bukti_jenis_lainnya: pemilih.bukti_jenis_lainnya,
    bukti_nomor: pemilih.bukti_nomor,
  });
}

export async function PUT(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const bukti = validasiBuktiIdentitas(body);
  if ("error" in bukti) return errorJson(bukti.error, 400);

  const db = await getDb(await resolveAppMode());
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: claims!.pemilihId! });
  if (!pemilih) return errorJson("Data pemilih tidak ditemukan", 404);

  await db.collection<PemilihDpt>("pemilih_dpt").updateOne({ _id: pemilih._id }, { $set: bukti.data });

  return NextResponse.json({ ok: true, ...bukti.data });
}
