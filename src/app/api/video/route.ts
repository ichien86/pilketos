import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import { saveUploadedVideo } from "@/lib/upload";
import { newId } from "@/lib/id";
import type { VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

// US-10 -- kandidat mengunggah video kampanye (status awal draft).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["kandidat"]) || !claims.kandidatId) {
    return errorJson("Tidak diizinkan", 403);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return errorJson("File video wajib diunggah", 400);

  let url: string;
  try {
    url = await saveUploadedVideo(file);
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : "Gagal menyimpan video", 400);
  }

  const db = await getDb(await resolveAppMode());
  const doc: VideoKampanye = {
    _id: newId(),
    kandidat_id: claims.kandidatId,
    url,
    status: "draft",
    created_at: new Date(),
    published_at: null,
  };
  await db.collection<VideoKampanye>("video_kampanye").insertOne(doc);
  return NextResponse.json(doc, { status: 201 });
}

export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  const db = await getDb(await resolveAppMode());
  const filter: Record<string, unknown> = { status: "aktif" };
  if (claims?.role === "kandidat" && claims.kandidatId) {
    filter.kandidat_id = claims.kandidatId;
    delete filter.status; // kandidat lihat semua videonya sendiri termasuk draft
  }
  const list = await db.collection<VideoKampanye>("video_kampanye").find(filter).toArray();
  return NextResponse.json(list);
}
