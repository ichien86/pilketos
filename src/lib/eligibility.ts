import type { Db } from "mongodb";
import type { DbMode } from "@/lib/db";
import { getFase } from "@/lib/fase-gate";
import type { AkunPengguna, Kandidat, ProgressPemilih } from "@/types";

/**
 * Daftar kandidat_id yang wajib sudah ditonton videonya. Mode "prod" pakai
 * snapshot kandidat_terkunci (dibekukan saat fase sosialisasi ASLI dibuka --
 * lihat US-12, mencegah daftar kandidat berubah-ubah di tengah sosialisasi).
 * Mode "simulasi" (uji coba) TIDAK pernah melalui alur buka-fase-sosialisasi
 * yang sesungguhnya (itu selalu di database prod), jadi dihitung langsung
 * dari kandidat berstatus aktif di database simulasi saat ini -- tanpa
 * snapshot, supaya menguji kandidat/video tidak perlu buka-tutup fase apa pun.
 */
export async function kandidatWajibDitonton(db: Db, mode: DbMode): Promise<string[]> {
  if (mode === "simulasi") {
    const list = await db
      .collection<Kandidat>("kandidat")
      .find({ status: "aktif" }, { projection: { _id: 1 } })
      .toArray();
    return list.map((k) => k._id);
  }
  const faseSosialisasi = await getFase("sosialisasi");
  const terkunciId = faseSosialisasi.kandidat_terkunci ?? [];
  if (terkunciId.length === 0) return [];
  const valid = await db
    .collection<Kandidat>("kandidat")
    .find({ _id: { $in: terkunciId }, status: { $ne: "dibatalkan" } }, { projection: { _id: 1 } })
    .toArray();
  return valid.map((k) => k._id);
}

/**
 * Syarat lolos check-in (Bagian 3 dok. teknis): akun sudah aktivasi DAN
 * sudah menonton semua video kandidat wajib (lihat kandidatWajibDitonton).
 * SELALU dihitung ulang dari server di sini -- dipakai baik di langkah scan
 * (langkah 1, hanya ditampilkan) maupun di langkah ACC (langkah 2, validasi
 * ulang sebelum mengubah status apa pun -- jangan percaya hasil langkah 1).
 */
export async function hitungLolosSyarat(
  db: Db,
  pemilihId: string,
  akun: AkunPengguna | null,
  mode: DbMode
): Promise<boolean> {
  if (!akun?.aktivasi_selesai) return false;

  const [progress, wajib] = await Promise.all([
    db.collection<ProgressPemilih>("progress_pemilih").findOne({ pemilih_id: pemilihId }),
    kandidatWajibDitonton(db, mode),
  ]);
  const ditonton = new Set(progress?.video_ditonton ?? []);
  if (wajib.length === 0) return false;
  return wajib.every((id) => ditonton.has(id));
}
