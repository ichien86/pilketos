import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { processAndSavePhoto } from "@/lib/photo";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// Upload foto ketua/wakil -- background dihilangkan otomatis, dipotong jadi
// avatar persegi transparan (lihat lib/photo.ts). Sama seperti field lain,
// HANYA bisa diubah selama kandidat masih berstatus draft (US-06/US-07).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb("prod");
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);
  if (kandidat.status !== "draft") {
    return errorJson("Kandidat yang sudah dipublish/dibatalkan tidak bisa diedit bebas lagi", 409);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const slot = form?.get("slot");
  if (!(file instanceof File)) return errorJson("File foto wajib diunggah", 400);
  if (slot !== "ketua" && slot !== "wakil") return errorJson("slot harus 'ketua' atau 'wakil'", 400);

  let url: string;
  try {
    url = await processAndSavePhoto(file);
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : "Gagal memproses foto", 400);
  }

  const field = slot === "ketua" ? "foto_ketua" : "foto_wakil";
  await db.collection<Kandidat>("kandidat").updateOne(
    { _id: params.id },
    { $set: { [field]: url, updated_at: new Date() } }
  );
  const updated = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  return NextResponse.json(updated);
}
