import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import type { ProgressPemilih, VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

// US-11 -- tercatat otomatis saat video pemilih putar sampai selesai (event "ended").
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"]) || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 403);
  }

  const [faseSosialisasi, fasePemilihan] = await Promise.all([
    getFase("sosialisasi"),
    getFase("pemilihan"),
  ]);

  if (faseSosialisasi.status === "belum_dibuka") {
    return errorJson("Masa sosialisasi belum dibuka", 403);
  }
  if (fasePemilihan.status === "ditutup") {
    return errorJson("Masa pemilihan sudah selesai", 403);
  }

  const mode = await resolveAppMode();
  const db = await getDb(mode);
  const video = await db
    .collection<VideoKampanye>("video_kampanye")
    .findOne({ _id: params.id, status: "aktif" });
  if (!video) return errorJson("Video tidak ditemukan", 404);

  await db.collection<ProgressPemilih>("progress_pemilih").updateOne(
    { pemilih_id: claims.pemilihId },
    {
      $addToSet: { video_ditonton: video.kandidat_id },
      $set: { updated_at: new Date() },
      $setOnInsert: { _id: newId(), pemilih_id: claims.pemilihId },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
