import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { signSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import type { AkunPengguna, Bilik, Kandidat, KontrolFase, PemilihDpt, ProgressPemilih, SesiPemilih } from "@/types";
import { URUTAN_FASE } from "@/types";

export async function seedFaseAktifPemilihan() {
  const db = await getDb("prod");
  const now = new Date();
  await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
  await db.collection<KontrolFase>("kontrol_fase").insertMany(
    URUTAN_FASE.map((nama) => ({
      _id: newId(),
      nama_fase: nama,
      status: nama === "pemilihan" ? "aktif" : "ditutup",
      dibuka_at: nama === "pemilihan" ? now : now,
      ditutup_at: nama === "pemilihan" ? null : now,
      kandidat_terkunci: nama === "sosialisasi" ? [] : null,
      hasil_diumumkan: false,
      hasil_diumumkan_at: null,
    }))
  );
}

export async function seedPemilih(overrides: Partial<PemilihDpt> = {}) {
  const db = await getDb("prod");
  const pemilih: PemilihDpt = {
    _id: newId(),
    jenis: "siswa",
    nis_nip: `T${Math.floor(Math.random() * 1e6)}`,
    nama: "Pemilih Test",
    kelas: "XII-1",
    pangkat: null,
    tanggal_lahir: "2008-01-01",
    foto_kartu_pelajar: null,
    created_at: new Date(),
    ...overrides,
  };
  await db.collection<PemilihDpt>("pemilih_dpt").insertOne(pemilih);
  return pemilih;
}

export async function seedKandidatAktif(nomorUrut: number) {
  const db = await getDb("prod");
  const kandidat: Kandidat = {
    _id: newId(),
    nomor_urut: nomorUrut,
    nama_ketua: `Ketua ${nomorUrut}`,
    nama_wakil: `Wakil ${nomorUrut}`,
    foto_ketua: "x",
    foto_wakil: "x",
    visi: "visi",
    misi: "misi",
    status: "aktif",
    dibatalkan_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  await db.collection<Kandidat>("kandidat").insertOne(kandidat);
  return kandidat;
}

export async function seedBilikKosong(nomorBilik: number) {
  const db = await getDb("prod");
  const bilik: Bilik = {
    _id: newId(),
    nomor_bilik: nomorBilik,
    qr_hash: `bilik-${nomorBilik}-${newId()}`,
    status: "kosong",
    sesi_aktif_id: null,
    created_at: new Date(),
  };
  await db.collection<Bilik>("bilik").insertOne(bilik);
  return bilik;
}

export async function seedSesiMenunggu(pemilihId: string, tokenHash: string) {
  const db = await getDb("prod");
  const sesi: SesiPemilih = {
    _id: newId(),
    pemilih_id: pemilihId,
    token_hash: tokenHash,
    status: "menunggu",
    antre_at: new Date(),
    masuk_bilik_at: null,
    selesai_at: null,
    bilik_id: null,
    token_plaintext_pending: null,
    token_delivered_at: null,
    barcode_bukti_hash: null,
    barcode_bukti_plain: null,
    barcode_used_at: null,
    kandidat_dipilih_nomor: null,
  };
  await db.collection<SesiPemilih>("sesi_pemilih").insertOne(sesi);
  return sesi;
}

/** Pemilih yang sudah aktivasi akun + sudah nonton semua video kandidat terkunci. */
export async function seedPemilihLolosSyarat(kandidatIds: string[]) {
  const db = await getDb("prod");
  const pemilih = await seedPemilih();
  const akun: AkunPengguna = {
    _id: newId(),
    pemilih_id: pemilih._id,
    kandidat_id: null,
    username: pemilih.nis_nip,
    password_hash: await hashPassword("dummy"),
    role: "pemilih",
    aktivasi_selesai: true,
    wajib_ganti_password: false,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(akun);
  const progress: ProgressPemilih = {
    _id: newId(),
    pemilih_id: pemilih._id,
    video_ditonton: kandidatIds,
    updated_at: new Date(),
  };
  await db.collection<ProgressPemilih>("progress_pemilih").insertOne(progress);
  await db.collection<KontrolFase>("kontrol_fase").updateOne(
    { nama_fase: "sosialisasi" },
    { $set: { kandidat_terkunci: kandidatIds } }
  );
  return pemilih;
}

export function loginCookieHeader(pemilihId: string): string {
  const token = signSession({
    akunId: newId(),
    pemilihId,
    kandidatId: null,
    role: "pemilih",
    username: "test",
  });
  return `pilketos_session=${token}`;
}
