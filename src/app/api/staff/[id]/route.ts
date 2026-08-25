import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { PERAN_STAF_BOLEH } from "@/lib/staff";
import type { AkunPengguna } from "@/types";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb("prod");
  const akun = await db
    .collection<AkunPengguna>("akun_pengguna")
    .findOne({ _id: params.id, role: { $in: PERAN_STAF_BOLEH } });
  if (!akun) return errorJson("Akun tidak ditemukan", 404);

  await db.collection<AkunPengguna>("akun_pengguna").deleteOne({ _id: akun._id });
  return NextResponse.json({ ok: true });
}
