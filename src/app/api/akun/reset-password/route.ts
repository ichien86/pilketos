import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import type { AkunPengguna, ResetLog } from "@/types";

export const dynamic = "force-dynamic";

// US-04 -- reset password oleh panitia/admin. Mengembalikan pemilih ke status
// "belum aktivasi" (harus mengulang alur US-02 termasuk cek tanggal lahir),
// dengan password DIKEMBALIKAN KE DEFAULT SISTEM (bukan dibuat acak) --
// sama seperti password awal semua akun sebelum pernah aktivasi (DEFAULT_PASSWORD,
// default "MAN3Byl"), supaya panitia tidak perlu mencatat/membagikan password
// unik per reset.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) {
    return errorJson("Tidak diizinkan", 403);
  }

  const body = await req.json().catch(() => null);
  const usernameAtauNama =
    typeof body?.username === "string" ? body.username : "";
  if (!usernameAtauNama) return errorJson("username wajib diisi", 400);

  const db = await getDb(await resolveAppMode());
  const akun = await db
    .collection<AkunPengguna>("akun_pengguna")
    .findOne({ username: usernameAtauNama, role: "pemilih" });
  if (!akun) return errorJson("Akun pemilih tidak ditemukan", 404);

  const defaultPassword = process.env.DEFAULT_PASSWORD ?? "MAN3Byl";
  const hash = await hashPassword(defaultPassword);

  await db.collection<AkunPengguna>("akun_pengguna").updateOne(
    { _id: akun._id },
    {
      $set: {
        password_hash: hash,
        aktivasi_selesai: false,
        wajib_ganti_password: true,
      },
    }
  );
  await db.collection<ResetLog>("reset_log").insertOne({
    _id: newId(),
    pemilih_id: akun.pemilih_id!,
    direset_oleh: claims.akunId,
    created_at: new Date(),
  });

  return NextResponse.json({
    ok: true,
    username: akun.username,
    password_sementara: defaultPassword,
  });
}
