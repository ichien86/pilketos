import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { hashPassword, verifyPassword, setSessionCookie } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { validasiBuktiIdentitas } from "@/lib/bukti-identitas";
import { clearRateLimit, getClientIp, isRateLimited, recordHit } from "@/lib/rate-limit";
import type { AkunPengguna, PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// US-02 (aktivasi pertama / aktivasi ulang setelah reset password).
// Aktivasi dapat dilakukan sejak masa pendataan dibuka sampai pemilihan selesai.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Anti brute-force aktivasi: maks 60 kegagalan per menit per IP (ramah NAT Wi-Fi sekolah)
  const ipCheck = isRateLimited(`aktivasi:ip:${ip}`, 60, 60);
  if (ipCheck.limited) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak percobaan aktivasi gagal dari jaringan ini. Silakan tunggu 1 menit sebelum mencoba kembali.",
      },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } }
    );
  }

  const mode = await resolveAppMode();
  const [fasePendataan, fasePemilihan] = await Promise.all([
    getFase("pendataan"),
    getFase("pemilihan"),
  ]);

  if (fasePendataan.status === "belum_dibuka") {
    return errorJson("Masa pendataan belum dibuka", 403);
  }
  if (fasePemilihan.status === "ditutup") {
    return errorJson(
      "Masa pemilihan sudah selesai -- aktivasi akun tidak dapat dilakukan lagi",
      403
    );
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

  // Anti brute-force tebak tanggal lahir akun spesifik: maks 5 kegagalan per menit
  const userCheck = isRateLimited(`aktivasi:user:${username.toLowerCase()}`, 5, 60);
  if (userCheck.limited) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak percobaan aktivasi gagal untuk akun ini. Silakan tunggu 1 menit sebelum mencoba kembali.",
      },
      { status: 429, headers: { "Retry-After": String(userCheck.retryAfter) } }
    );
  }

  const bukti = validasiBuktiIdentitas(body);
  if ("error" in bukti) return errorJson(bukti.error, 400);

  const db = await getDb(mode);
  const akun = await db
    .collection<AkunPengguna>("akun_pengguna")
    .findOne({ username, role: "pemilih" });
  if (!akun) {
    recordHit(`aktivasi:ip:${ip}`);
    return errorJson("username atau password salah", 401);
  }
  if (akun.aktivasi_selesai) {
    return errorJson("Akun ini sudah pernah diaktivasi -- silakan login biasa", 409);
  }

  const passwordCocok = await verifyPassword(passwordDefault, akun.password_hash);
  if (!passwordCocok) {
    recordHit(`aktivasi:ip:${ip}`);
    recordHit(`aktivasi:user:${username.toLowerCase()}`);
    return errorJson("username atau password salah", 401);
  }

  const pemilih = await db
    .collection<PemilihDpt>("pemilih_dpt")
    .findOne({ _id: akun.pemilih_id! });
  if (!pemilih || pemilih.tanggal_lahir !== tanggalLahir) {
    // Password TIDAK diubah -- mencegah orang lain merebut akun hanya
    // dengan menebak NIS/NIP (kriteria penerimaan US-02).
    recordHit(`aktivasi:ip:${ip}`);
    recordHit(`aktivasi:user:${username.toLowerCase()}`);
    return errorJson("Tanggal lahir tidak cocok dengan data DPT", 401);
  }

  // Aktivasi berhasil: bersihkan limit kegagalan user
  clearRateLimit(`aktivasi:user:${username.toLowerCase()}`);

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
  await db.collection<PemilihDpt>("pemilih_dpt").updateOne(
    { _id: pemilih._id },
    { $set: bukti.data }
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
