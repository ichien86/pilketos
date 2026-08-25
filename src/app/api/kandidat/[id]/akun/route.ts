import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import type { AkunPengguna, Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// US-09 -- buat akun login untuk paslon (satu akun dipegang bersama ketua+wakil).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb(await resolveAppMode());
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);

  const sudahAda = await db
    .collection<AkunPengguna>("akun_pengguna")
    .findOne({ kandidat_id: params.id });
  if (sudahAda) return errorJson("Kandidat ini sudah punya akun", 409);

  const body = await req.json().catch(() => null as { username?: string } | null);
  const username =
    typeof body?.username === "string" && body.username
      ? body.username
      : `paslon${kandidat.nomor_urut}`;
  const bentrok = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username });
  if (bentrok) return errorJson("Username sudah dipakai", 409);

  const tempPassword = randomBytes(6).toString("base64url");
  const doc: AkunPengguna = {
    _id: newId(),
    pemilih_id: null,
    kandidat_id: params.id,
    username,
    password_hash: await hashPassword(tempPassword),
    role: "kandidat",
    aktivasi_selesai: false,
    wajib_ganti_password: true,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(doc);

  return NextResponse.json(
    { username, password_sementara: tempPassword },
    { status: 201 }
  );
}
