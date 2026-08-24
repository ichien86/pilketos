import type { Db } from "mongodb";
import type { AkunPengguna, KontrolFase, ProgressPemilih } from "@/types";

/**
 * Syarat lolos check-in (Bagian 3 dok. teknis): akun sudah aktivasi DAN
 * sudah menonton semua video kandidat yang terkunci sejak sosialisasi dibuka.
 * SELALU dihitung ulang dari server di sini -- dipakai baik di langkah scan
 * (langkah 1, hanya ditampilkan) maupun di langkah ACC (langkah 2, validasi
 * ulang sebelum mengubah status apa pun -- jangan percaya hasil langkah 1).
 */
export async function hitungLolosSyarat(
  db: Db,
  pemilihId: string,
  akun: AkunPengguna | null
): Promise<boolean> {
  if (!akun?.aktivasi_selesai) return false;

  const [progress, faseSosialisasi] = await Promise.all([
    db.collection<ProgressPemilih>("progress_pemilih").findOne({ pemilih_id: pemilihId }),
    db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: "sosialisasi" }),
  ]);
  const ditonton = new Set(progress?.video_ditonton ?? []);
  const terkunci = faseSosialisasi?.kandidat_terkunci ?? [];
  if (terkunci.length === 0) return false;
  return terkunci.every((id) => ditonton.has(id));
}
