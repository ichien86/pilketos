import { getDb, dropSimulasiDatabase } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

/**
 * Fase "simulasi" = mode uji coba: begitu dibuka, SEMUA fitur (DPT, kandidat,
 * video/sosialisasi, bilik, hari-H) otomatis pindah ke database ini (lihat
 * resolveAppMode() di fase-gate.ts) -- terpisah total dari data produksi,
 * dan direset habis begitu fase ini ditutup (teardownSimulasi). Sengaja
 * TIDAK diisi data dummy otomatis lagi -- justru DPT/kandidat/bilik itu
 * sendiri yang mau diuji coba lewat UI yang sama seperti pemakaian
 * sungguhan, bukan dilewati dengan data siap-pakai.
 */
export async function seedSimulasi(): Promise<void> {
  await dropSimulasiDatabase();
  const db = await getDb("simulasi");
  await ensureIndexes(db);
}

export async function teardownSimulasi(): Promise<void> {
  await dropSimulasiDatabase();
}
