import type { Db } from "mongodb";
import { getDb, type DbMode } from "@/lib/db";

/** Index penting sesuai rencana implementasi -- dipanggil dari scripts/setup-db.ts. */
export async function ensureIndexes(db: Db): Promise<void> {
  await db
    .collection("pemilih_dpt")
    .createIndex({ nis_nip: 1 }, { unique: true });
  await db
    .collection("akun_pengguna")
    .createIndex({ username: 1 }, { unique: true });
  await db
    .collection("akun_pengguna")
    .createIndex({ pemilih_id: 1 }, { sparse: true });
  await db.collection("kandidat").createIndex(
    { nomor_urut: 1 },
    {
      unique: true,
      // Partial index Mongo tidak mendukung $ne/$not -- daftar eksplisit
      // status yang diikutkan (semua status kecuali "dibatalkan").
      partialFilterExpression: { status: { $in: ["draft", "aktif"] } },
    }
  );
  await db.collection("video_kampanye").createIndex({ kandidat_id: 1 });
  await db
    .collection("progress_pemilih")
    .createIndex({ pemilih_id: 1 }, { unique: true });
  await db
    .collection("kontrol_fase")
    .createIndex({ nama_fase: 1 }, { unique: true });
  await db
    .collection("sesi_pemilih")
    .createIndex({ token_hash: 1 }, { unique: true, sparse: true });
  await db
    .collection("sesi_pemilih")
    .createIndex({ barcode_bukti_hash: 1 }, { sparse: true });
  await db
    .collection("sesi_pemilih")
    .createIndex({ pemilih_id: 1, status: 1 });
  // Cegah dual-ACC di level database, bukan cuma cek findOne-lalu-insert di
  // endpoint (yang punya jendela race kalau dua request ACC untuk pemilih
  // yang sama tiba nyaris bersamaan, mis. dua meja check-in atau tap ganda).
  // Partial index Mongo tidak mendukung $ne/$not -- daftar eksplisit status
  // yang dihitung "masih/sudah pernah ACC hari ini".
  await db.collection("sesi_pemilih").createIndex(
    { pemilih_id: 1 },
    {
      unique: true,
      partialFilterExpression: {
        status: { $in: ["menunggu", "di_bilik", "sudah_memilih", "selesai"] },
      },
    }
  );
  await db.collection("bilik").createIndex({ qr_hash: 1 }, { unique: true });
  await db.collection("bilik").createIndex({ nomor_bilik: 1 }, { unique: true });
  await db.collection("suara").createIndex({ kandidat_id: 1 });
}

export async function ensureIndexesFor(mode: DbMode): Promise<void> {
  const db = await getDb(mode);
  await ensureIndexes(db);
}
