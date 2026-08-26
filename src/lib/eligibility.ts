import type { Db } from "mongodb";
import { getFase } from "@/lib/fase-gate";
import type { AkunPengguna, Kandidat, PemilihDpt, ProgressPemilih } from "@/types";

/**
 * Daftar kandidat_id yang wajib sudah ditonton videonya -- snapshot
 * kandidat_terkunci yang dibekukan saat fase sosialisasi dibuka (US-12,
 * mencegah daftar kandidat berubah-ubah di tengah sosialisasi). getFase()
 * sendiri sudah otomatis mode-aware (lihat fase-gate.ts/mode.ts), jadi di
 * mode uji coba ini otomatis baca snapshot dari database sandbox -- TANPA
 * perlu tahu mode di sini sama sekali, selama `db` yang dipakai memanggil
 * fungsi ini juga sudah diresolve dengan mode yang sama oleh caller.
 */
export async function kandidatWajibDitonton(db: Db): Promise<string[]> {
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
export async function hitungLolosSyarat(db: Db, pemilihId: string, akun: AkunPengguna | null): Promise<boolean> {
  if (!akun?.aktivasi_selesai) return false;

  const [progress, wajib] = await Promise.all([
    db.collection<ProgressPemilih>("progress_pemilih").findOne({ pemilih_id: pemilihId }),
    kandidatWajibDitonton(db),
  ]);
  const ditonton = new Set(progress?.video_ditonton ?? []);
  if (wajib.length === 0) return false;
  return wajib.every((id) => ditonton.has(id));
}

/**
 * US-05 -- masa pendataan tidak boleh ditutup selagi masih ada pemilih di
 * DPT yang belum mengaktivasi akunnya, tidak ada pengecualian. DPT kosong
 * (belum ada yang diimpor) dianggap tidak menghalangi -- tidak ada yang
 * perlu ditunggu.
 */
export async function hitungPemilihBelumAktivasi(db: Db): Promise<{ total: number; belum: number }> {
  const total = await db.collection<PemilihDpt>("pemilih_dpt").countDocuments({});
  if (total === 0) return { total: 0, belum: 0 };
  const sudah = await db
    .collection<AkunPengguna>("akun_pengguna")
    .countDocuments({ role: "pemilih", aktivasi_selesai: true });
  return { total, belum: Math.max(0, total - sudah) };
}

/**
 * Masa sosialisasi tidak boleh ditutup selagi masih ada pemilih yang belum
 * menonton semua video kandidat wajib (kandidatWajibDitonton), tidak ada
 * pengecualian. Sama seperti hitungPemilihBelumAktivasi, DPT kosong atau
 * belum ada kandidat terkunci dianggap tidak menghalangi.
 */
export async function hitungPemilihBelumSosialisasi(db: Db): Promise<{ total: number; belum: number }> {
  const wajib = await kandidatWajibDitonton(db);
  const pemilihList = await db.collection<PemilihDpt>("pemilih_dpt").find({}, { projection: { _id: 1 } }).toArray();
  if (pemilihList.length === 0 || wajib.length === 0) return { total: pemilihList.length, belum: 0 };

  const progressList = await db
    .collection<ProgressPemilih>("progress_pemilih")
    .find({ pemilih_id: { $in: pemilihList.map((p) => p._id) } }, { projection: { pemilih_id: 1, video_ditonton: 1 } })
    .toArray();
  const ditontonByPemilih = new Map(progressList.map((p) => [p.pemilih_id, new Set(p.video_ditonton)]));

  const belum = pemilihList.filter((p) => {
    const ditonton = ditontonByPemilih.get(p._id) ?? new Set<string>();
    return !wajib.every((id) => ditonton.has(id));
  }).length;

  return { total: pemilihList.length, belum };
}
