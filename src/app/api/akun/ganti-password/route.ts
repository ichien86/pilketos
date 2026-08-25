import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, verifyPassword } from "@/lib/auth";
import type { AkunPengguna } from "@/types";

export const dynamic = "force-dynamic";

// Ganti password wajib di login pertama untuk akun kandidat (US-09/US-10)
// dan jalur ganti password umum lainnya (bukan pemilih -- pemilih pakai
// /api/akun/aktivasi untuk login pertama karena butuh cek tanggal lahir).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims) return errorJson("Tidak diizinkan", 401);

  const body = await req.json().catch(() => null);
  const passwordLama = typeof body?.password_lama === "string" ? body.password_lama : "";
  const passwordBaru = typeof body?.password_baru === "string" ? body.password_baru : "";
  if (!passwordLama || !passwordBaru) return errorJson("password_lama dan password_baru wajib diisi", 400);
  if (passwordBaru.length < 8) return errorJson("Password baru minimal 8 karakter", 400);

  // Akun kandidat/pemilih hasil mode uji coba (fase simulasi) hidup di
  // database simulasi, bukan prod -- cek dua-duanya persis seperti
  // /api/auth/login, supaya endpoint ini tetap benar terlepas dari akun
  // yang sedang ganti password itu akun sungguhan atau akun uji coba.
  const dbProd = await getDb("prod");
  let db = dbProd;
  let akun = await dbProd.collection<AkunPengguna>("akun_pengguna").findOne({ _id: claims.akunId });
  if (!akun) {
    const dbSimulasi = await getDb("simulasi").catch(() => null);
    akun = (await dbSimulasi?.collection<AkunPengguna>("akun_pengguna").findOne({ _id: claims.akunId })) ?? null;
    if (akun && dbSimulasi) db = dbSimulasi;
  }
  if (!akun) return errorJson("Akun tidak ditemukan", 404);

  const cocok = await verifyPassword(passwordLama, akun.password_hash);
  if (!cocok) return errorJson("Password lama salah", 401);
  if (passwordLama === passwordBaru) return errorJson("Password baru tidak boleh sama dengan password lama", 400);

  await db.collection<AkunPengguna>("akun_pengguna").updateOne(
    { _id: akun._id },
    { $set: { password_hash: await hashPassword(passwordBaru), wajib_ganti_password: false, aktivasi_selesai: true } }
  );
  return NextResponse.json({ ok: true });
}
