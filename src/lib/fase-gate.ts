import type { Db } from "mongodb";
import { getDb, type DbMode } from "@/lib/db";
import { URUTAN_FASE, type KontrolFase, type StatusFase } from "@/types";

/**
 * Mesin status fase itu SATU untuk seluruh sekolah, jadi selalu disimpan di
 * database produksi (getDb("prod")) -- termasuk saat fase "simulasi" sedang
 * aktif, karena "sedang simulasi" itu sendiri adalah bagian dari status
 * global, bukan data yang diisolasi (yang diisolasi adalah data pemilih/
 * kandidat/sesi/bilik-nya, lihat db.ts & keputusan desain #4).
 */
export async function getFaseDb(): Promise<Db> {
  return getDb("prod");
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
 * Alur hari-H (checkin, ACC, klaim bilik, submit vote, exit scan) dipakai
 * ulang persis sama baik untuk fase "simulasi" (US-20) maupun fase
 * "pemilihan" sungguhan -- yang membedakan cuma database mana yang dipakai.
 * Fungsi ini SATU-SATUNYA tempat yang memutuskan mode itu, berdasarkan fase
 * global mana yang sedang aktif (server-authoritative, bukan dari client).
 */
export async function resolveHariHMode(): Promise<DbMode> {
  const [simulasi, pemilihan] = await Promise.all([
    getFase("simulasi"),
    getFase("pemilihan"),
  ]);
  if (simulasi.status === "aktif") return "simulasi";
  if (pemilihan.status === "aktif") return "prod";
  throw new FaseGateError(
    "Alur hari-H hanya bisa dipakai saat fase simulasi atau pemilihan aktif"
  );
}

export function urutanIndex(nama: StatusFase): number {
  return URUTAN_FASE.indexOf(nama);
}

/**
 * Mode aplikasi untuk fitur DI LUAR alur hari-H (DPT, kandidat, video/
 * sosialisasi, bilik) -- fase "simulasi" sekarang berfungsi ganda sebagai
 * mode "uji coba": begitu aktif, SEMUA fitur itu otomatis pindah ke database
 * simulasi (data terpisah, direset total saat fase ini ditutup -- lihat
 * lib/simulasi.ts), tanpa perlu buka/tutup fase pendataan/pendaftaran_calon/
 * sosialisasi yang ASLI. TIDAK PERNAH throw (beda dari resolveHariHMode) --
 * fitur-fitur ini harus selalu bisa dipakai, aktif "prod" adalah default.
 */
export async function resolveAppMode(): Promise<DbMode> {
  const simulasi = await getFase("simulasi");
  return simulasi.status === "aktif" ? "simulasi" : "prod";
}
