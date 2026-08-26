import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// US-07 -- publish kandidat: field wajib harus lengkap, lalu terkunci dari edit bebas.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(_req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const mode = await resolveAppMode();
  const fasePendaftaran = await getFase("pendaftaran_calon");
  if (fasePendaftaran.status !== "aktif") {
    return errorJson("Publish kandidat hanya bisa dilakukan selama masa pendaftaran calon aktif", 403);
  }

  const db = await getDb(mode);
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);
  if (kandidat.status !== "draft") {
    return errorJson("Hanya kandidat berstatus draft yang bisa dipublish", 409);
  }

  const wajib = [kandidat.nama_ketua, kandidat.nama_wakil, kandidat.foto_ketua, kandidat.foto_wakil, kandidat.visi, kandidat.misi];
  if (wajib.some((v) => !v)) {
    return errorJson("Field wajib belum lengkap: nama ketua/wakil, kedua foto, visi, misi", 422);
  }

  await db.collection<Kandidat>("kandidat").updateOne(
    { _id: params.id },
    { $set: { status: "aktif", updated_at: new Date() } }
  );
  const updated = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  return NextResponse.json(updated);
}
