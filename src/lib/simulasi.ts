import { getDb, dropSimulasiDatabase } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { hashPassword } from "@/lib/auth";
import { newId } from "@/lib/id";
import type {
  AkunPengguna,
  Bilik,
  Kandidat,
  KontrolFase,
  PemilihDpt,
  ProgressPemilih,
  VideoKampanye,
} from "@/types";

const JUMLAH_PEMILIH_DUMMY = 20;
const JUMLAH_KANDIDAT_DUMMY = 3;
const JUMLAH_BILIK_DUMMY = 3;

/**
 * US-19 -- buka fase simulasi = reset total + seed database simulasi terpisah
 * (bukan sekadar flag di data yang sama). Dipanggil dari API buka-fase maupun
 * scripts/seed-simulasi.ts untuk seeding manual/ulang di luar alur fase.
 */
export async function seedSimulasi(): Promise<void> {
  await dropSimulasiDatabase();
  const db = await getDb("simulasi");
  await ensureIndexes(db);

  const now = new Date();
  const defaultHash = await hashPassword("Simulasi123");

  const pemilihDocs: PemilihDpt[] = [];
  const akunDocs: AkunPengguna[] = [];
  for (let i = 1; i <= JUMLAH_PEMILIH_DUMMY; i++) {
    const pemilihId = newId();
    pemilihDocs.push({
      _id: pemilihId,
      jenis: "siswa",
      nis_nip: `SIM${String(i).padStart(3, "0")}`,
      nama: `Pemilih Dummy ${i}`,
      kelas: "XII-SIM",
      pangkat: null,
      tanggal_lahir: "2008-01-01",
      foto_kartu_pelajar: null,
      created_at: now,
    });
    akunDocs.push({
      _id: newId(),
      pemilih_id: pemilihId,
      kandidat_id: null,
      username: `SIM${String(i).padStart(3, "0")}`,
      password_hash: defaultHash,
      role: "pemilih",
      aktivasi_selesai: true, // dummy langsung aktif supaya gladi bersih tidak perlu ulang alur aktivasi
      wajib_ganti_password: false,
      created_at: now,
    });
  }

  const kandidatDocs: Kandidat[] = [];
  const videoDocs: VideoKampanye[] = [];
  for (let i = 1; i <= JUMLAH_KANDIDAT_DUMMY; i++) {
    const kandidatId = newId();
    kandidatDocs.push({
      _id: kandidatId,
      nomor_urut: i,
      nama_ketua: `Ketua Dummy ${i}`,
      nama_wakil: `Wakil Dummy ${i}`,
      foto_ketua: null,
      foto_wakil: null,
      visi: `Visi dummy paslon ${i}`,
      misi: `Misi dummy paslon ${i}`,
      status: "aktif",
      dibatalkan_at: null,
      created_at: now,
      updated_at: now,
    });
    videoDocs.push({
      _id: newId(),
      kandidat_id: kandidatId,
      url: "/uploads/video/dummy.mp4",
      status: "aktif",
      created_at: now,
      published_at: now,
    });
  }

  const progressDocs: ProgressPemilih[] = pemilihDocs.map((p) => ({
    _id: newId(),
    pemilih_id: p._id,
    video_ditonton: kandidatDocs.map((k) => k._id), // dummy dianggap sudah nonton semua
    updated_at: now,
  }));

  const bilikDocs: Bilik[] = [];
  for (let i = 1; i <= JUMLAH_BILIK_DUMMY; i++) {
    bilikDocs.push({
      _id: newId(),
      nomor_bilik: i,
      qr_hash: `sim-bilik-${i}-${newId().slice(0, 8)}`,
      status: "kosong",
      sesi_aktif_id: null,
      created_at: now,
    });
  }

  const kontrolFaseSosialisasiDummy: KontrolFase = {
    _id: newId(),
    nama_fase: "sosialisasi",
    status: "ditutup",
    dibuka_at: now,
    ditutup_at: now,
    kandidat_terkunci: kandidatDocs.map((k) => k._id),
  };

  if (pemilihDocs.length) await db.collection<PemilihDpt>("pemilih_dpt").insertMany(pemilihDocs);
  if (akunDocs.length) await db.collection<AkunPengguna>("akun_pengguna").insertMany(akunDocs);
  if (kandidatDocs.length) await db.collection<Kandidat>("kandidat").insertMany(kandidatDocs);
  if (videoDocs.length) await db.collection<VideoKampanye>("video_kampanye").insertMany(videoDocs);
  if (progressDocs.length) await db.collection<ProgressPemilih>("progress_pemilih").insertMany(progressDocs);
  if (bilikDocs.length) await db.collection<Bilik>("bilik").insertMany(bilikDocs);
  await db.collection<KontrolFase>("kontrol_fase").insertOne(kontrolFaseSosialisasiDummy);
}

export async function teardownSimulasi(): Promise<void> {
  await dropSimulasiDatabase();
}
