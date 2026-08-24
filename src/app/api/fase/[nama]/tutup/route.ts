import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase } from "@/lib/fase-gate";
import { teardownSimulasi } from "@/lib/simulasi";
import type { KontrolFase, StatusFase } from "@/types";
import { URUTAN_FASE } from "@/types";

export const dynamic = "force-dynamic";

// US-18 -- tutup fase. Menutup "simulasi" juga menghapus total database
// simulasi (US-19). Menutup "pendataan" mengunci endpoint aktivasi (US-05).
export async function POST(
  req: NextRequest,
  { params }: { params: { nama: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const nama = params.nama as StatusFase;
  if (!URUTAN_FASE.includes(nama)) return errorJson("Nama fase tidak dikenal", 400);

  const fase = await getFase(nama);
  if (fase.status !== "aktif") return errorJson("Fase ini sedang tidak aktif", 409);

  const db = await getDb("prod");
  await db.collection<KontrolFase>("kontrol_fase").updateOne(
    { nama_fase: nama },
    { $set: { status: "ditutup", ditutup_at: new Date() } }
  );

  if (nama === "simulasi") {
    await teardownSimulasi();
  }

  const updated = await db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: nama });
  return NextResponse.json(updated);
}
