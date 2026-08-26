import { unlink } from "fs/promises";
import { getDb, dropSimulasiDatabase, type DbMode } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { ensureChecklistSeeded } from "@/lib/checklist";
import { newId } from "@/lib/id";
import { uploadUrlToPath } from "@/lib/upload-path";
import { URUTAN_FASE, type Kandidat, type KontrolFase, type PengaturanMode, type VideoKampanye } from "@/types";

const DOC_ID = "mode";

export class ModeGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModeGateError";
  }
}

/**
 * Flag mode uji coba SELALU dibaca/ditulis di database produksi -- ini
 * satu-satunya sumber kebenaran untuk "kita sedang di dunia mana", jadi
 * tidak boleh dia sendiri ikut jadi mode-aware (chicken-and-egg).
 */
async function getPengaturanMode(): Promise<PengaturanMode> {
  const db = await getDb("prod");
  const doc = await db.collection<PengaturanMode>("pengaturan_mode").findOne({ _id: DOC_ID });
  return doc ?? { _id: DOC_ID, uji_coba_aktif: false, diaktifkan_at: null, dinonaktifkan_at: null };
}

export async function isUjiCobaAktif(): Promise<boolean> {
  const pengaturan = await getPengaturanMode();
  return pengaturan.uji_coba_aktif;
}

/** Satu-satunya tempat yang memutuskan database mana yang dipakai fitur di luar hari-H. */
export async function resolveAppMode(): Promise<DbMode> {
  return (await isUjiCobaAktif()) ? "simulasi" : "prod";
}

/**
 * Nyalakan mode uji coba: siapkan database sandbox dari nol (index, checklist
 * Go/No-Go kosong, dan kelima dokumen fase "belum_dibuka" -- persis kondisi
 * awal produksi) supaya admin/panitia mengulang alur buka-fase yang PERSIS
 * SAMA seperti hari-H sungguhan, cuma datanya terisolasi.
 */
export async function aktifkanUjiCoba(): Promise<void> {
  // Kalau ada fase ASLI yang sedang aktif di produksi, JANGAN nyalakan --
  // begitu flag ini true, semua endpoint (DPT, aktivasi, kandidat, dst) yang
  // membaca lewat resolveAppMode() langsung pindah baca/tulis ke sandbox
  // yang masih kosong. Bagi orang yang sedang memakai fase produksi itu,
  // ini akan terlihat seolah semua data hilang / aktivasi tiba-tiba ditolak
  // -- padahal data aslinya aman, cuma sedang tidak dibaca. Harus dipastikan
  // tidak ada proses sungguhan yang sedang berjalan dulu.
  const prodDb = await getDb("prod");
  const faseAktifProd = await prodDb.collection<KontrolFase>("kontrol_fase").findOne({ status: "aktif" });
  if (faseAktifProd) {
    throw new ModeGateError(
      `Fase "${faseAktifProd.nama_fase}" sedang aktif di produksi -- tutup dulu sebelum menyalakan mode uji coba, supaya proses sungguhan yang sedang berjalan tidak ikut teralihkan ke sandbox.`
    );
  }

  await dropSimulasiDatabase();
  const sandboxDb = await getDb("simulasi");
  await ensureIndexes(sandboxDb);
  await ensureChecklistSeeded(sandboxDb);

  const now = new Date();
  const faseDocs: KontrolFase[] = URUTAN_FASE.map((nama) => ({
    _id: newId(),
    nama_fase: nama,
    status: "belum_dibuka",
    dibuka_at: null,
    ditutup_at: null,
    kandidat_terkunci: null,
    hasil_diumumkan: false,
    hasil_diumumkan_at: null,
  }));
  await sandboxDb.collection<KontrolFase>("kontrol_fase").insertMany(faseDocs);

  await prodDb.collection<PengaturanMode>("pengaturan_mode").updateOne(
    { _id: DOC_ID },
    { $set: { uji_coba_aktif: true, diaktifkan_at: now, dinonaktifkan_at: null } },
    { upsert: true }
  );
}

/**
 * Foto kandidat & video kampanye disimpan sebagai FILE FISIK di disk
 * (bukan di MongoDB) dengan nama acak, jadi dropDatabase() sendiri tidak
 * pernah menyentuhnya -- tanpa ini, tiap sesi uji coba yang sempat unggah
 * foto/video meninggalkan file yatim di volume selamanya, lama-lama
 * menghabiskan disk. Dikumpulkan dan dihapus di sini SEBELUM database
 * sandbox-nya sendiri dihapus.
 */
async function hapusFileUploadSandbox(): Promise<void> {
  const sandboxDb = await getDb("simulasi");
  const [kandidatList, videoList] = await Promise.all([
    sandboxDb.collection<Kandidat>("kandidat").find({}, { projection: { foto_ketua: 1, foto_wakil: 1 } }).toArray(),
    sandboxDb.collection<VideoKampanye>("video_kampanye").find({}, { projection: { url: 1 } }).toArray(),
  ]);
  const urls = [
    ...kandidatList.flatMap((k) => [k.foto_ketua, k.foto_wakil]),
    ...videoList.map((v) => v.url),
  ].filter((u): u is string => !!u);

  await Promise.all(
    urls.map(async (url) => {
      const filePath = uploadUrlToPath(url);
      if (!filePath) return;
      await unlink(filePath).catch(() => {
        // Aman diabaikan -- file mungkin sudah tidak ada, bukan hal fatal.
      });
    })
  );
}

/**
 * Matikan mode uji coba: hapus TOTAL database sandbox -- DPT, kandidat,
 * video, bilik, sesi, suara, checklist, DAN status kelima fase-nya sendiri,
 * semua dalam satu database yang sama, jadi satu dropDatabase() sudah
 * cukup untuk mereset semuanya sekaligus. File foto/video fisiknya (di
 * luar database) dibersihkan terpisah sebelum database-nya dihapus.
 */
export async function matikanUjiCoba(): Promise<void> {
  await hapusFileUploadSandbox().catch(() => {
    // Kegagalan bersih-bersih file TIDAK boleh menghalangi reset data --
    // lebih baik ada file yatim tersisa daripada mode uji coba gagal mati.
  });
  await dropSimulasiDatabase();
  const prodDb = await getDb("prod");
  await prodDb.collection<PengaturanMode>("pengaturan_mode").updateOne(
    { _id: DOC_ID },
    { $set: { uji_coba_aktif: false, dinonaktifkan_at: new Date() } },
    { upsert: true }
  );
}
