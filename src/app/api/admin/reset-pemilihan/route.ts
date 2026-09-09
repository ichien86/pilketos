import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { ensureIndexes } from "@/lib/indexes";
import { isUjiCobaAktif } from "@/lib/mode";
import { uploadUrlToPath } from "@/lib/upload-path";
import type { Kandidat, KontrolFase, VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Cek status kesiapan reset data pemilihan produksi untuk periode baru.
 * Hanya Admin yang boleh mengakses.
 */
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const ujiCobaAktif = await isUjiCobaAktif();
  const prodDb = await getDb("prod");
  const fasePemilihan = await prodDb.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: "pemilihan" });

  const pemilihanDitutup = fasePemilihan?.status === "ditutup";
  const hasilDiumumkan = Boolean(fasePemilihan?.hasil_diumumkan);
  const siapReset = pemilihanDitutup && hasilDiumumkan && !ujiCobaAktif;

  return NextResponse.json({
    siap_reset: siapReset,
    uji_coba_aktif: ujiCobaAktif,
    pemilihan_ditutup: pemilihanDitutup,
    hasil_diumumkan: hasilDiumumkan,
  });
}

/**
 * Reset data pemilihan produksi untuk persiapan periode baru.
 * KETENTUAN PENGAMAN:
 * 1. Hanya Admin.
 * 2. Mode uji coba harus nonaktif.
 * 3. Fase pemilihan HARUS sudah berstatus "ditutup".
 * 4. Hasil pemungutan suara HARUS sudah berstatus "hasil_diumumkan: true".
 * 5. Body harus menyertakan teks konfirmasi "RESET-PEMILIHAN".
 */
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  // 1. Cek mode uji coba
  if (await isUjiCobaAktif()) {
    return errorJson(
      "Tidak dapat mereset data produksi saat Mode Uji Coba sedang aktif. Silakan matikan mode uji coba terlebih dahulu.",
      400
    );
  }

  const prodDb = await getDb("prod");

  // 2. Cek apakah tahap pemilihan sudah selesai & hasil sudah diumumkan
  const fasePemilihan = await prodDb.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: "pemilihan" });
  if (!fasePemilihan || fasePemilihan.status !== "ditutup" || !fasePemilihan.hasil_diumumkan) {
    return errorJson(
      "Reset data pemilihan hanya dapat dilakukan setelah seluruh tahapan selesai (tahap Pemilihan ditutup dan Hasil Pemungutan Suara telah resmi diumumkan).",
      400
    );
  }

  // 3. Cek teks konfirmasi
  const body = await req.json().catch(() => null);
  if (body?.konfirmasi !== "RESET-PEMILIHAN") {
    return errorJson(
      "Teks konfirmasi salah. Harap ketik persis 'RESET-PEMILIHAN' untuk mengonfirmasi tindakan ini.",
      400
    );
  }

  // 4. Hapus file fisik (foto kandidat & video kampanye) dari disk server
  try {
    const [kandidatList, videoList] = await Promise.all([
      prodDb.collection<Kandidat>("kandidat").find({}, { projection: { foto_ketua: 1, foto_wakil: 1 } }).toArray(),
      prodDb.collection<VideoKampanye>("video_kampanye").find({}, { projection: { url: 1 } }).toArray(),
    ]);

    const urls = [
      ...kandidatList.flatMap((k) => [k.foto_ketua, k.foto_wakil]),
      ...videoList.map((v) => v.url),
    ].filter((u): u is string => Boolean(u));

    await Promise.all(
      urls.map(async (url) => {
        const filePath = uploadUrlToPath(url);
        if (!filePath) return;
        await unlink(filePath).catch(() => {
          // Abaikan jika file sudah tidak ada
        });
      })
    );
  } catch {
    // Abaikan kegagalan pembersihan file agar tidak menghambat reset database
  }

  // 5. Hapus seluruh data transaksi pemilihan dari koleksi MongoDB
  await Promise.all([
    prodDb.collection("suara").deleteMany({}),
    prodDb.collection("sesi_pemilih").deleteMany({}),
    prodDb.collection("progress_pemilih").deleteMany({}),
    prodDb.collection("bilik").deleteMany({}),
    prodDb.collection("kandidat").deleteMany({}),
    prodDb.collection("video_kampanye").deleteMany({}),
    prodDb.collection("pemilih_dpt").deleteMany({}),
    // Hapus akun pemilih & kandidat, tapi PERTAHANKAN akun staf (admin, panitia, pengawas)
    prodDb.collection("akun_pengguna").deleteMany({ role: { $in: ["pemilih", "kandidat"] } }),
    prodDb.collection("reset_log").deleteMany({}),
    prodDb.collection("anomali_scan").deleteMany({}),
  ]);

  // 6. Kembalikan ke-4 fase ke status awal (belum_dibuka)
  await prodDb.collection<KontrolFase>("kontrol_fase").updateMany(
    {},
    {
      $set: {
        status: "belum_dibuka",
        dibuka_at: null,
        ditutup_at: null,
        kandidat_terkunci: null,
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      },
    }
  );

  // 7. Re-index MongoDB untuk memastikan index siap untuk periode baru
  await ensureIndexes(prodDb);

  return NextResponse.json({
    ok: true,
    message: "Data pemilihan berhasil direset untuk periode baru. Seluruh tahapan telah dikembalikan ke awal dan siap digunakan kembali.",
  });
}
