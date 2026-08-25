import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, requireRole } from "@/lib/auth";
import { newId } from "@/lib/id";
import { DEFAULT_STAFF_PASSWORD, PERAN_STAF_BOLEH } from "@/lib/staff";
import type { AkunPengguna } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb("prod");
  const list = await db
    .collection<AkunPengguna>("akun_pengguna")
    .find({ role: { $in: PERAN_STAF_BOLEH } })
    .sort({ created_at: 1 })
    .toArray();

  return NextResponse.json(
    list.map((a) => ({
      _id: a._id,
      username: a.username,
      role: a.role,
      wajib_ganti_password: a.wajib_ganti_password,
      created_at: a.created_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const role = body?.role;
  const username = typeof body?.username === "string" ? body.username.trim() : "";

  if (!PERAN_STAF_BOLEH.includes(role)) {
    return errorJson(`role wajib salah satu dari: ${PERAN_STAF_BOLEH.join(", ")}`, 400);
  }
  if (!username) return errorJson("username wajib diisi", 400);

  const db = await getDb("prod");
  const bentrok = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username });
  if (bentrok) return errorJson(`Username "${username}" sudah dipakai`, 409);

  const doc: AkunPengguna = {
    _id: newId(),
    pemilih_id: null,
    kandidat_id: null,
    username,
    password_hash: await hashPassword(DEFAULT_STAFF_PASSWORD),
    role,
    aktivasi_selesai: true,
    wajib_ganti_password: true,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(doc);

  return NextResponse.json(
    { _id: doc._id, username: doc.username, role: doc.role, password_default: DEFAULT_STAFF_PASSWORD },
    { status: 201 }
  );
}
