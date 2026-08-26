import type { Db } from "mongodb";
import { getDb, type DbMode } from "@/lib/db";
import { resolveAppMode } from "@/lib/mode";
import { URUTAN_FASE, type KontrolFase, type StatusFase } from "@/types";

export { resolveAppMode };

/**
 * Mesin status fase (pendataan..pemilihan) ikut database mana yang sedang
 * "aktif" secara mode -- resolveAppMode() (lib/mode.ts) yang memutuskan
 * produksi atau sandbox uji coba. Ini BUKAN fase tersendiri: alur buka/tutup
 * kelima fase di atas identik persis di kedua mode, cuma datanya (termasuk
 * status fase itu sendiri) hidup di database terpisah saat uji coba aktif.
 */
export async function getFaseDb(): Promise<Db> {
  return getDb(await resolveAppMode());
}

export async function getAllFase(): Promise<KontrolFase[]> {
  const db = await getFaseDb();
  const docs = await db
    .collection<KontrolFase>("kontrol_fase")
    .find({})
    .toArray();
  const byName = new Map(docs.map((d) => [d.nama_fase, d]));
  return URUTAN_FASE.map(
    (nama) =>
      byName.get(nama) ?? {
        _id: nama,
        nama_fase: nama,
        status: "belum_dibuka",
        dibuka_at: null,
        ditutup_at: null,
        kandidat_terkunci: null,
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      }
  );
}

export async function getFase(nama: StatusFase): Promise<KontrolFase> {
  const all = await getAllFase();
  return all.find((f) => f.nama_fase === nama)!;
}

export class FaseGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaseGateError";
  }
}

/** Pastikan fase tertentu sedang aktif, lempar FaseGateError kalau tidak. */
export async function requireFaseAktif(nama: StatusFase): Promise<KontrolFase> {
  const fase = await getFase(nama);
  if (fase.status !== "aktif") {
    throw new FaseGateError(`Fase "${nama}" sedang tidak aktif`);
  }
  return fase;
}

/**
 * Alur hari-H (checkin, ACC, klaim bilik, submit vote, exit scan) butuh fase
 * "pemilihan" aktif -- di mode produksi maupun uji coba, cek dan databasenya
 * SAMA-SAMA otomatis ikut resolveAppMode() lewat getFase() di atas, jadi
 * fungsi ini tinggal memastikan gerbangnya lalu meneruskan mode yang sama.
 */
export async function resolveHariHMode(): Promise<DbMode> {
  const mode = await resolveAppMode();
  const fase = await getFase("pemilihan");
  if (fase.status !== "aktif") {
    throw new FaseGateError("Alur hari-H hanya bisa dipakai saat fase pemilihan aktif");
  }
  return mode;
}

export function urutanIndex(nama: StatusFase): number {
  return URUTAN_FASE.indexOf(nama);
}
