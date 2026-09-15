import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import type { SesiPemilih, PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// Verifikasi keluar manual oleh panitia/admin untuk pemilih yang sudah memilih
// di bilik tetapi belum scan keluar setelah jeda waktu minimal 5 menit.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const pemilihId = typeof body?.pemilihId === "string" ? body.pemilihId.trim() : "";
  const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
  const detailAlasan = typeof body?.detailAlasan === "string" ? body.detailAlasan.trim() : "";

  if (!pemilihId) return errorJson("pemilihId wajib diisi", 400);
  if (!alasan) return errorJson("Alasan verifikasi keluar manual wajib dipilih", 400);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const sesi = await db.collection<SesiPemilih>("sesi_pemilih").findOne(
    { pemilih_id: pemilihId, status: "sudah_memilih", barcode_used_at: null },
    { sort: { antre_at: -1 } }
  );

  if (!sesi) {
    return errorJson("Sesi pemilih tidak ditemukan atau sudah selesai scan keluar sebelumnya", 404);
  }

  if (!sesi.selesai_at) {
    return errorJson("Waktu selesai mencoblos pemilih tidak valid", 400);
  }

  const diffMs = Date.now() - new Date(sesi.selesai_at).getTime();
  const minimalMs = 5 * 60 * 1000; // 5 menit
  if (diffMs < minimalMs) {
    const sisaDetik = Math.ceil((minimalMs - diffMs) / 1000);
    const sisaMenit = Math.ceil(sisaDetik / 60);
    return errorJson(
      `Belum mencapai jeda waktu 5 menit sejak pemilih mencoblos. Harap tunggu ${sisaMenit} menit lagi (${sisaDetik} detik).`,
      400
    );
  }

  const alasanFinal = alasan === "Lainnya" && detailAlasan ? `Lainnya: ${detailAlasan}` : alasan;

  await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
    { _id: sesi._id },
    {
      $set: {
        status: "selesai",
        barcode_used_at: new Date(),
        keluar_manual: true,
        alasan_keluar_manual: alasanFinal,
      },
    }
  );

  await db.collection<PemilihDpt>("pemilih_dpt").updateOne(
    { _id: pemilihId },
    { $set: { sudah_memilih: true } }
  );

  return NextResponse.json({
    berhasil: true,
    pesan: `Berhasil memverifikasi keluar secara manual untuk pemilih. Alasan: ${alasanFinal}`,
  });
}

