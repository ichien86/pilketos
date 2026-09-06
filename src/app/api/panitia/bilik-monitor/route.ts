import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import type { Bilik, SesiPemilih, Suara } from "@/types";

export const dynamic = "force-dynamic";

// US-26 -- status semua bilik secara real-time di satu layar pantauan.
// Mengikuti mode hari-H yang sedang aktif (simulasi atau pemilihan sungguhan).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const list = await db.collection<Bilik>("bilik").find({}).sort({ nomor_bilik: 1 }).toArray();

  // Ambil sesi aktif untuk bilik yang sedang terisi guna menghitung durasi
  const activeSessionIds = list
    .filter((b) => b.status === "terisi" && b.sesi_aktif_id)
    .map((b) => b.sesi_aktif_id!);

  const sessions =
    activeSessionIds.length > 0
      ? await db
          .collection<SesiPemilih>("sesi_pemilih")
          .find({ _id: { $in: activeSessionIds } })
          .toArray()
      : [];

  const sessionMap = new Map(sessions.map((s) => [s._id, s]));
  const now = Date.now();

  const bilikEnhanced = list.map((b) => {
    const sesi = b.sesi_aktif_id ? sessionMap.get(b.sesi_aktif_id) : null;
    const masukAt = sesi?.masuk_bilik_at ? new Date(sesi.masuk_bilik_at) : null;
    const durasiDetik = masukAt ? Math.max(0, Math.floor((now - masukAt.getTime()) / 1000)) : 0;

    return {
      _id: b._id,
      nomor_bilik: b.nomor_bilik,
      status: b.status,
      masuk_bilik_at: masukAt ? masukAt.toISOString() : null,
      durasi_detik: b.status === "terisi" ? durasiDetik : 0,
    };
  });

  const totalBilik = list.length;
  const bilikKosong = list.filter((b) => b.status === "kosong").length;
  const bilikTerisi = list.filter((b) => b.status === "terisi").length;

  // Statistik Throughput TPS
  const antreanMenunggu = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .countDocuments({ status: "menunggu" });

  const totalSuara = await db.collection<Suara>("suara").countDocuments({});
  const totalSelesai = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .countDocuments({ status: { $in: ["sudah_memilih", "selesai"] } });

  return NextResponse.json({
    mode,
    bilik: bilikEnhanced,
    ringkasan: {
      total_bilik: totalBilik,
      bilik_kosong: bilikKosong,
      bilik_terisi: bilikTerisi,
      antrean_menunggu: antreanMenunggu,
      total_suara: totalSuara,
      total_selesai: totalSelesai,
    },
  });
}

