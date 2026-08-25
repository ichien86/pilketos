import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { hashPassword, verifyPassword, setSessionCookie } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import type { AkunPengguna, PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// US-02 (aktivasi pertama) + US-05 (gerbang penutupan masa pendataan).
export async function POST(req: NextRequest) {
  const mode = await resolveAppMode();
  if (mode === "prod") {
    const fase = await getFase("pendataan");
    if (fase.status !== "aktif") {
      return errorJson(
        "Masa pendataan sudah ditutup -- aktivasi akun tidak bisa lagi dilakukan, tidak ada pengecualian",
        403
      );
    }
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const passwordDefault =
    typeof body?.password === "string" ? body.password : "";
  const tanggalLahir =
    typeof body?.tanggal_lahir === "string" ? body.tanggal_lahir : "";
  const passwordBaru =
    typeof body?.password_baru === "string" ? body.password_baru : "";

  if (!username || !passwordDefault || !tanggalLahir || !passwordBaru) {
    return errorJson(
      "username, password, tanggal_lahir, dan password_baru wajib diisi",
      400
    );
  }

  const db = await getDb(mode);
  const akun = await db
    .collection<AkunPengguna>("akun_pengguna")
    .findOne({ username, role: "pemilih" });
  if (!akun) return errorJson("username atau password salah", 401);
  if (akun.aktivasi_selesai) {
    return errorJson("Akun ini sudah pernah diaktivasi -- silakan login biasa", 409);
  }

  const passwordCocok = await verifyPassword(passwordDefault, akun.password_hash);
  if (!passwordCocok) return errorJson("username atau password salah", 401);

  const pemilih = await db
    .collection<PemilihDpt>("pemilih_dpt")
    .findOne({ _id: akun.pemilih_id! });
  if (!pemilih || pemilih.tanggal_lahir !== tanggalLahir) {
    // Password TIDAK diubah -- mencegah orang lain merebut akun hanya
    // dengan menebak NIS/NIP (kriteria penerimaan US-02).
    return errorJson("Tanggal lahir tidak cocok dengan data DPT", 401);
  }

  const defaultPassword = process.env.DEFAULT_PASSWORD ?? "MAN3Byl";
  if (passwordBaru.length < 8 || passwordBaru === defaultPassword) {
    return errorJson(
      "Password baru minimal 8 karakter dan tidak boleh sama dengan password default",
      400
    );
  }

  const newHash = await hashPassword(passwordBaru);
  await db.collection<AkunPengguna>("akun_pengguna").updateOne(
    { _id: akun._id },
    {
      $set: {
        password_hash: newHash,
        aktivasi_selesai: true,
        wajib_ganti_password: false,
      },
    }
  );

  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, {
    akunId: akun._id,
    pemilihId: akun.pemilih_id,
    kandidatId: null,
    role: "pemilih",
    username: akun.username,
  });
}
