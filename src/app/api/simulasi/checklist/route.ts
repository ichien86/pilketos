import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import type { ChecklistItem } from "@/types";

export const dynamic = "force-dynamic";

// US-21 -- checklist Go/No-Go sebelum fase pemilihan dibuka. Mode-aware
// (lihat resolveAppMode()) supaya bisa ikut dicoba di sandbox uji coba.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);
  const db = await getDb(await resolveAppMode());
  const list = await db.collection<ChecklistItem>("checklist_gonogo").find({}).toArray();
  return NextResponse.json(list);
}

export async function PATCH(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const kode = typeof body?.kode === "string" ? body.kode : "";
  const lolos = typeof body?.lolos === "boolean" ? body.lolos : null;
  const catatan = typeof body?.catatan === "string" ? body.catatan : null;
  if (!kode || lolos === null) return errorJson("kode dan lolos wajib diisi", 400);

  const db = await getDb(await resolveAppMode());
  const result = await db.collection<ChecklistItem>("checklist_gonogo").updateOne(
    { kode },
    { $set: { lolos, catatan, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) return errorJson("Item checklist tidak ditemukan", 404);

  const updated = await db.collection<ChecklistItem>("checklist_gonogo").findOne({ kode });
  return NextResponse.json(updated);
}
