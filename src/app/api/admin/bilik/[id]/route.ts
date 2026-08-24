import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { Bilik } from "@/types";

export const dynamic = "force-dynamic";

// US-26 -- tidak bisa hapus bilik yang sedang terisi.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb("prod");
  const bilik = await db.collection<Bilik>("bilik").findOne({ _id: params.id });
  if (!bilik) return errorJson("Bilik tidak ditemukan", 404);
  if (bilik.status === "terisi") {
    return errorJson("Bilik sedang terisi -- tidak bisa dihapus", 409);
  }

  await db.collection<Bilik>("bilik").deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true });
}
