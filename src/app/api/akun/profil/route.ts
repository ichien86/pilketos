import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import type { PemilihDpt, ProfilOpsional } from "@/types";

export const dynamic = "force-dynamic";

// US-03 -- profil opsional (alamat, hobi), terpisah dari data resmi DPT.
// `nama` di respons GET dibaca read-only dari pemilih_dpt (bukan bagian dari
// profil opsional) -- dipakai dashboard /pemilih untuk sapaan "Selamat
// datang, <nama>". getDb() di sini WAJIB ikut resolveAppMode() (bukan
// hardcode "prod") supaya pemilih yang sedang berada di sandbox uji coba
// tidak salah baca/tulis ke profil produksi.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims || claims.role !== "pemilih" || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 401);
  }
  const db = await getDb(await resolveAppMode());
  const [profil, pemilih] = await Promise.all([
    db.collection<ProfilOpsional>("profil_opsional").findOne({ pemilih_id: claims.pemilihId }),
    db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: claims.pemilihId }),
  ]);
  return NextResponse.json({
    nama: pemilih?.nama ?? null,
    alamat: profil?.alamat ?? null,
    hobi: profil?.hobi ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims || claims.role !== "pemilih" || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 401);
  }
  const fase = await getFase("pendataan");
  if (fase.status !== "aktif") {
    return errorJson("Masa pendataan sudah ditutup -- profil tidak bisa diubah lagi", 403);
  }
  const body = await req.json().catch(() => null);
  const alamat = typeof body?.alamat === "string" ? body.alamat.slice(0, 500) : null;
  const hobi = typeof body?.hobi === "string" ? body.hobi.slice(0, 500) : null;

  const db = await getDb(await resolveAppMode());
  await db.collection<ProfilOpsional>("profil_opsional").updateOne(
    { pemilih_id: claims.pemilihId },
    {
      $set: { alamat, hobi, updated_at: new Date() },
      $setOnInsert: { _id: newId(), pemilih_id: claims.pemilihId },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
