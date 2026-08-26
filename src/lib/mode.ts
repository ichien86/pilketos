import { getDb, dropSimulasiDatabase, type DbMode } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { ensureChecklistSeeded } from "@/lib/checklist";
import { newId } from "@/lib/id";
import { URUTAN_FASE, type KontrolFase, type PengaturanMode } from "@/types";

const DOC_ID = "mode";

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

  const prodDb = await getDb("prod");
  await prodDb.collection<PengaturanMode>("pengaturan_mode").updateOne(
    { _id: DOC_ID },
    { $set: { uji_coba_aktif: true, diaktifkan_at: now, dinonaktifkan_at: null } },
    { upsert: true }
  );
}

/**
 * Matikan mode uji coba: hapus TOTAL database sandbox -- DPT, kandidat,
 * video, bilik, sesi, suara, checklist, DAN status kelima fase-nya sendiri,
 * semua dalam satu database yang sama, jadi satu dropDatabase() sudah
 * cukup untuk mereset semuanya sekaligus.
 */
export async function matikanUjiCoba(): Promise<void> {
  await dropSimulasiDatabase();
  const prodDb = await getDb("prod");
  await prodDb.collection<PengaturanMode>("pengaturan_mode").updateOne(
    { _id: DOC_ID },
    { $set: { uji_coba_aktif: false, dinonaktifkan_at: new Date() } },
    { upsert: true }
  );
}
