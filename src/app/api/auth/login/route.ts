import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp, recordHit } from "@/lib/rate-limit";
import type { AkunPengguna } from "@/types";

export const dynamic = "force-dynamic";

// Anti brute-force: maks 5 kegagalan login per menit per IP atau username
const BRUTE_FORCE_LIMIT = 5;
const BRUTE_FORCE_WINDOW = 60; // detik

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Cek rate limit per IP sebelum parsing body
  const ipCheck = checkRateLimit(`login:ip:${ip}`, BRUTE_FORCE_LIMIT, BRUTE_FORCE_WINDOW);
  if (ipCheck.limited) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak percobaan login gagal. Silakan tunggu 1 menit sebelum mencoba kembali.",
      },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return errorJson("username dan password wajib diisi", 400);
  }

  // Cek rate limit per username
  const userCheck = checkRateLimit(
    `login:user:${username.toLowerCase()}`,
    BRUTE_FORCE_LIMIT,
    BRUTE_FORCE_WINDOW
  );
  if (userCheck.limited) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak percobaan login gagal. Silakan tunggu 1 menit sebelum mencoba kembali.",
      },
      { status: 429, headers: { "Retry-After": String(userCheck.retryAfter) } }
    );
  }

  // Akun panitia/admin/kandidat/pemilih ASLI selalu di database produksi.
  // Akun pemilih DUMMY (Epic 6, gladi bersih) hanya ada di database simulasi
  // -- dicoba kalau tidak ketemu di produksi, supaya login tetap satu pintu.
  const dbProd = await getDb("prod");
  let akun = await dbProd.collection<AkunPengguna>("akun_pengguna").findOne({ username });
  if (!akun) {
    const dbSimulasi = await getDb("simulasi").catch(() => null);
    akun = (await dbSimulasi?.collection<AkunPengguna>("akun_pengguna").findOne({ username })) ?? null;
  }
  if (!akun) {
    // Catat kegagalan
    recordHit(`login:ip:${ip}`);
    recordHit(`login:user:${username.toLowerCase()}`);
    return errorJson("username atau password salah", 401);
  }

  // Sebelum aktivasi, password_hash pemilih masih password default yang SAMA
  // untuk semua orang -- kalau endpoint ini dibiarkan menerimanya, siapa pun
  // yang tahu/menebak NIS/NIP bisa "login" tanpa pernah dicek tanggal lahir.
  // Jalur aktivasi pertama (US-02) WAJIB lewat /api/akun/aktivasi.
  if (akun.role === "pemilih" && !akun.aktivasi_selesai) {
    return errorJson(
      "Akun belum diaktivasi -- lakukan aktivasi pertama (username, password default, tanggal lahir) lewat halaman aktivasi",
      403
    );
  }

  const cocok = await verifyPassword(password, akun.password_hash);
  if (!cocok) {
    // Catat kegagalan
    recordHit(`login:ip:${ip}`);
    recordHit(`login:user:${username.toLowerCase()}`);
    return errorJson("username atau password salah", 401);
  }

  const res = NextResponse.json({
    role: akun.role,
    aktivasi_selesai: akun.aktivasi_selesai,
    wajib_ganti_password: akun.wajib_ganti_password,
  });
  return setSessionCookie(res, {
    akunId: akun._id,
    pemilihId: akun.pemilih_id,
    kandidatId: akun.kandidat_id,
    role: akun.role,
    username: akun.username,
  });
}
