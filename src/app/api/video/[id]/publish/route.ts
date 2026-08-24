import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { Kandidat, VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

// US-10 -- kandidat publish video sendiri; ditolak kalau status kandidatnya belum aktif.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["kandidat"]) || !claims.kandidatId) {
    return errorJson("Tidak diizinkan", 403);
  }

  const db = await getDb("prod");
  const video = await db.collection<VideoKampanye>("video_kampanye").findOne({ _id: params.id });
  if (!video) return errorJson("Video tidak ditemukan", 404);
  if (video.kandidat_id !== claims.kandidatId) return errorJson("Tidak diizinkan", 403);
  if (video.status === "aktif") return errorJson("Video sudah dipublish", 409);

  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: claims.kandidatId });
  if (!kandidat || kandidat.status !== "aktif") {
    return errorJson("Status kandidat Anda belum aktif -- video belum bisa dipublish", 403);
  }

  await db.collection<VideoKampanye>("video_kampanye").updateOne(
    { _id: params.id },
    { $set: { status: "aktif", published_at: new Date() } }
  );
  const updated = await db.collection<VideoKampanye>("video_kampanye").findOne({ _id: params.id });
  return NextResponse.json(updated);
}
