import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import type { Bilik } from "@/types";

export const dynamic = "force-dynamic";

// US-26 -- status semua bilik secara real-time di satu layar pantauan.
// Mengikuti mode hari-H yang sedang aktif (simulasi atau pemilihan sungguhan).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const list = await db.collection<Bilik>("bilik").find({}).sort({ nomor_bilik: 1 }).toArray();
  return NextResponse.json({ mode, bilik: list });
}
