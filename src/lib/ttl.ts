import type { Db } from "mongodb";
import { TTL_MENUNGGU_MS, TTL_DI_BILIK_MS, type Bilik, type SesiPemilih } from "@/types";

/**
 * Dua lapis TTL (Bagian 5 dok. teknis v6):
 *  - "menunggu"  -> longgar, dihitung dari antre_at
 *  - "di_bilik"  -> ketat, dihitung dari masuk_bilik_at, dan melepas bilik
 *
 * Dipanggil di dua tempat (keputusan desain #2):
 *  1. Lazy-check di setiap endpoint yang membaca sesi_pemilih, supaya benar
 *     walau cron belum sempat jalan.
 *  2. Cron sweep terpisah (scripts/cron-sweep.ts) supaya bilik terlepas
 *     proaktif walau tidak ada request masuk.
 */

export function isSesiExpired(sesi: SesiPemilih, now = new Date()): boolean {
  if (sesi.status === "menunggu") {
    return now.getTime() - sesi.antre_at.getTime() > TTL_MENUNGGU_MS;
  }
  if (sesi.status === "di_bilik" && sesi.masuk_bilik_at) {
    return now.getTime() - sesi.masuk_bilik_at.getTime() > TTL_DI_BILIK_MS;
  }
  return false;
}

/**
 * Cek+expire satu sesi secara lazy. Kalau sesi berstatus "di_bilik" dan
 * kedaluwarsa, bilik dilepas dalam transaksi yang sama (Bagian 4.4).
 * Mengembalikan sesi ter-update (status "kedaluwarsa" kalau memang expired).
 */
export async function expireSesiIfNeeded(
  db: Db,
  sesi: SesiPemilih
): Promise<SesiPemilih> {
  if (!isSesiExpired(sesi)) return sesi;

  const wasDiBilik = sesi.status === "di_bilik";
  await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
    { _id: sesi._id, status: sesi.status },
    { $set: { status: "kedaluwarsa", selesai_at: new Date() } }
  );
  if (wasDiBilik && sesi.bilik_id) {
    await db.collection<Bilik>("bilik").updateOne(
      { _id: sesi.bilik_id, sesi_aktif_id: sesi._id },
      { $set: { status: "kosong", sesi_aktif_id: null } }
    );
  }
  return { ...sesi, status: "kedaluwarsa", selesai_at: new Date() };
}

/** Dipanggil oleh cron: sapu semua sesi aktif yang sudah lewat TTL-nya. */
export async function sweepExpiredSesi(db: Db): Promise<number> {
  const now = new Date();
  const kandidatMenunggu = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .find({
      status: "menunggu",
      antre_at: { $lt: new Date(now.getTime() - TTL_MENUNGGU_MS) },
    })
    .toArray();
  const kandidatDiBilik = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .find({
      status: "di_bilik",
      masuk_bilik_at: { $lt: new Date(now.getTime() - TTL_DI_BILIK_MS) },
    })
    .toArray();

  let count = 0;
  for (const sesi of [...kandidatMenunggu, ...kandidatDiBilik]) {
    await expireSesiIfNeeded(db, sesi);
    count++;
  }
  return count;
}
