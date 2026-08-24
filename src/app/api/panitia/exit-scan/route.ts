import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { hashToken } from "@/lib/voteToken";
import { newId } from "@/lib/id";
import type { AnomaliScan, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// US-16 -- scan barcode bukti di meja keluar. Scan kedua pada barcode yang
// sama ditolak otomatis dan dicatat sebagai anomali. Aksi ini TIDAK PERNAH
// mengubah status suara -- suara sudah terkunci sejak submit (US-14).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const buktiToken = typeof body?.buktiToken === "string" ? body.buktiToken : "";
  if (!buktiToken) return errorJson("buktiToken wajib diisi", 400);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const hash = hashToken(buktiToken);
  const sesi = await db.collection<SesiPemilih>("sesi_pemilih").findOne({ barcode_bukti_hash: hash });
  if (!sesi) return errorJson("Barcode bukti tidak dikenali", 404);

  if (sesi.barcode_used_at) {
    await db.collection<AnomaliScan>("anomali_scan").insertOne({
      _id: newId(),
      jenis: "barcode_bukti_reused",
      sesi_id: sesi._id,
      created_at: new Date(),
      detail: `Barcode bukti sesi ${sesi._id} discan ulang -- scan pertama pada ${sesi.barcode_used_at.toISOString()}`,
    });
    return errorJson("Barcode ini sudah pernah discan sebelumnya -- ditolak & dicatat sebagai anomali", 409);
  }

  await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
    { _id: sesi._id },
    { $set: { barcode_used_at: new Date(), status: "selesai" } }
  );
  return NextResponse.json({ berhasil: true });
}
