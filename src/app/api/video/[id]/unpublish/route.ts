import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import type { VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

// Membatalkan publish video (mengembalikan status video dari aktif ke draft).
// Paslon hanya boleh unpublish sebelum fase sosialisasi dibuka.
// Panitia & Admin dapat unpublish kapan saja jika ada revisi darurat konten.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["kandidat", "panitia", "admin"])) {
    return errorJson("Tidak diizinkan", 403);
  }

  const db = await getDb(await resolveAppMode());
  const video = await db.collection<VideoKampanye>("video_kampanye").findOne({ _id: params.id });
  if (!video) return errorJson("Video tidak ditemukan", 404);

  if (claims.role === "kandidat") {
    if (video.kandidat_id !== claims.kandidatId) {
      return errorJson("Tidak diizinkan mengubah video kandidat lain", 403);
    }

    // Paslon hanya boleh unpublish jika tahap sosialisasi belum dimulai
    const faseSosialisasi = await getFase("sosialisasi");
    if (faseSosialisasi.status !== "belum_dibuka") {
      return errorJson(
        "Tidak dapat membatalkan publish karena tahap sosialisasi sudah dimulai. Hubungi panitia jika memerlukan revisi video.",
        403
      );
    }
  }

  if (video.status === "draft") {
    return errorJson("Video sudah dalam status draft", 400);
  }

  await db.collection<VideoKampanye>("video_kampanye").updateOne(
    { _id: params.id },
    { $set: { status: "draft", published_at: null } }
  );

  const updated = await db.collection<VideoKampanye>("video_kampanye").findOne({ _id: params.id });
  return NextResponse.json(updated);
}
