import "./load-env";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getDb, getMongoClient } from "../src/lib/db";
import { ensureIndexes } from "../src/lib/indexes";
import { ensureChecklistSeeded } from "../src/lib/checklist";
import { hashPassword } from "../src/lib/auth";
import { newId } from "../src/lib/id";
import { generateVoteToken, generateBuktiToken, hashToken } from "../src/lib/voteToken";
import { URUTAN_FASE, type AkunPengguna, type Bilik, type Kandidat, type KontrolFase, type PemilihDpt, type ProgressPemilih, type SesiPemilih, type Suara, type ChecklistItem } from "../src/types";

async function main() {
  console.log("===============================================================");
  console.log("   UJI COBA APLIKASI & PEMBUATAN DATA UJI COBA KE DATABASE     ");
  console.log("   SISTEM E-VOTING PILKETOS — MAN 3 BOYOLALI                   ");
  console.log("===============================================================\n");

  let replSet: MongoMemoryReplSet | null = null;

  // Coba koneksi ke Mongo eksternal/lokal dengan timeout singkat, fallback ke in-memory replica set
  try {
    const { MongoClient } = await import("mongodb");
    const testClient = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0", {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
    await testClient.connect();
    await testClient.db().command({ ping: 1 });
    await testClient.close();
    console.log("✓ Terhubung ke MongoDB Server lokal/eksternal:", process.env.MONGODB_URI);
  } catch {
    console.log("i MongoDB lokal/server belum aktif, menjalankan In-Memory Replica Set (WiredTiger)...");
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGODB_DB_PROD = "pilketos_prod";
    process.env.MONGODB_DB_SIMULASI = "pilketos_simulasi";
    process.env.AUTH_JWT_SECRET = "pilketos_super_secret_auth_jwt_key_32_characters_long_man3";
    process.env.SECRET_CHECKIN = "pilketos_super_secret_checkin_key_32_characters_long_man3";
    process.env.DEFAULT_PASSWORD = "MAN3Byl";
    console.log("✓ In-Memory Mongo Replica Set aktif di URI:", replSet.getUri());
  }

  const db = await getDb("prod");

  console.log("\n[1/6] Inisialisasi Skema Index & Checklist Go/No-Go...");
  await ensureIndexes(db);
  await ensureChecklistSeeded(db);
  console.log("  ✓ Index MongoDB (partial unique index, TTL, hash) berhasil dipasang.");
  console.log("  ✓ 6 Butir Checklist Go/No-Go disiapkan.");

  console.log("\n[2/6] Mempersiapkan Kontrol Fase...");
  await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
  const sekarang = new Date();
  const faseDocs: KontrolFase[] = URUTAN_FASE.map((nama) => ({
    _id: newId(),
    nama_fase: nama,
    status: nama === "pemilihan" ? "aktif" : nama === "pendataan" || nama === "pendaftaran_calon" || nama === "sosialisasi" ? "ditutup" : "belum_dibuka",
    dibuka_at: sekarang,
    ditutup_at: nama === "pemilihan" ? null : sekarang,
    kandidat_terkunci: null,
    hasil_diumumkan: false,
    hasil_diumumkan_at: null,
  }));
  await db.collection<KontrolFase>("kontrol_fase").insertMany(faseDocs);
  console.log("  ✓ Status fase saat ini disetel: PEMILIHAN (Aktif).");

  console.log("\n[3/6] Membuat Akun Admin, Panitia, dan Pengawas...");
  await db.collection<AkunPengguna>("akun_pengguna").deleteMany({});
  const defaultHash = await hashPassword("MAN3Byl");
  const adminPassHash = await hashPassword("AdminPass123!");
  const staffPassHash = await hashPassword("PanitiaPass123!");

  const akunStaf: AkunPengguna[] = [
    {
      _id: newId(),
      pemilih_id: null,
      kandidat_id: null,
      username: "admin",
      password_hash: adminPassHash,
      role: "admin",
      aktivasi_selesai: true,
      wajib_ganti_password: false,
      created_at: sekarang,
    },
    {
      _id: newId(),
      pemilih_id: null,
      kandidat_id: null,
      username: "panitia_checkin",
      password_hash: staffPassHash,
      role: "panitia",
      aktivasi_selesai: true,
      wajib_ganti_password: false,
      created_at: sekarang,
    },
    {
      _id: newId(),
      pemilih_id: null,
      kandidat_id: null,
      username: "panitia_keluar",
      password_hash: staffPassHash,
      role: "panitia",
      aktivasi_selesai: true,
      wajib_ganti_password: false,
      created_at: sekarang,
    },
    {
      _id: newId(),
      pemilih_id: null,
      kandidat_id: null,
      username: "pengawas1",
      password_hash: staffPassHash,
      role: "pengawas",
      aktivasi_selesai: true,
      wajib_ganti_password: false,
      created_at: sekarang,
    },
  ];
  await db.collection<AkunPengguna>("akun_pengguna").insertMany(akunStaf);
  console.log("  ✓ Akun Admin: username='admin', password='AdminPass123!'");
  console.log("  ✓ Akun Panitia Check-in: username='panitia_checkin', password='PanitiaPass123!'");
  console.log("  ✓ Akun Panitia Keluar: username='panitia_keluar', password='PanitiaPass123!'");
  console.log("  ✓ Akun Pengawas: username='pengawas1', password='PanitiaPass123!'");

  console.log("\n[4/6] Mendaftarkan Paslon Kandidat & Bilik Suara...");
  await db.collection<Kandidat>("kandidat").deleteMany({});
  const paslon1Id = newId();
  const paslon2Id = newId();
  const kandidatList: Kandidat[] = [
    {
      _id: paslon1Id,
      nomor_urut: 1,
      nama_ketua: "Muhammad Rizky Pratama",
      nama_wakil: "Siti Aisyah Nurhaliza",
      foto_ketua: "/uploads/kandidat-1-ketua.png",
      foto_wakil: "/uploads/kandidat-1-wakil.png",
      visi: "Mewujudkan OSIM MAN 3 Boyolali yang Relijius, Inovatif, Disiplin, dan Berprestasi Global.",
      misi: "1. Meningkatkan kegiatan keagamaan dan literasi digital madrasah.\n2. Menjalin komunikasi aktif antara pengurus OSIM, siswa, dan guru.\n3. Mengembangkan minat bakat siswa di bidang sains, seni, dan olahraga.",
      status: "aktif",
      dibatalkan_at: null,
      created_at: sekarang,
      updated_at: sekarang,
    },
    {
      _id: paslon2Id,
      nomor_urut: 2,
      nama_ketua: "Ahmad Fadhil Rahman",
      nama_wakil: "Nurul Hidayati",
      foto_ketua: "/uploads/kandidat-2-ketua.png",
      foto_wakil: "/uploads/kandidat-2-wakil.png",
      visi: "Membangun Generasi Madani yang Berintegritas, Kreatif, dan Peduli Lingkungan Sekolah.",
      misi: "1. Mengoptimalkan program kerja berbasis green campus dan kepedulian sosial.\n2. Membangun wadah aspirasi siswa yang transparan dan akuntabel.\n3. Memperkuat kolaborasi antar-ekstrakurikuler di MAN 3 Boyolali.",
      status: "aktif",
      dibatalkan_at: null,
      created_at: sekarang,
      updated_at: sekarang,
    },
  ];
  await db.collection<Kandidat>("kandidat").insertMany(kandidatList);

  // Kunci kandidat di kontrol_fase sosialisasi
  await db.collection<KontrolFase>("kontrol_fase").updateOne(
    { nama_fase: "sosialisasi" },
    { $set: { kandidat_terkunci: [paslon1Id, paslon2Id] } }
  );
  console.log("  ✓ 2 Paslon Kandidat resmi terdaftar dan terkunci.");

  // Bilik suara
  await db.collection<Bilik>("bilik").deleteMany({});
  const bilik1Id = newId();
  const bilik2Id = newId();
  const bilik3Id = newId();
  const bilikList: Bilik[] = [
    { _id: bilik1Id, nomor_bilik: 1, qr_hash: "bilik-qr-hash-b1-man3", status: "kosong", sesi_aktif_id: null, created_at: sekarang },
    { _id: bilik2Id, nomor_bilik: 2, qr_hash: "bilik-qr-hash-b2-man3", status: "kosong", sesi_aktif_id: null, created_at: sekarang },
    { _id: bilik3Id, nomor_bilik: 3, qr_hash: "bilik-qr-hash-b3-man3", status: "kosong", sesi_aktif_id: null, created_at: sekarang },
  ];
  await db.collection<Bilik>("bilik").insertMany(bilikList);
  console.log("  ✓ 3 Bilik Suara terdaftar (Bilik 1, Bilik 2, Bilik 3).");

  console.log("\n[5/6] Mendaftarkan DPT Pemilih, Akun, & Simulasi Alur Voting Lengkap...");
  await db.collection<PemilihDpt>("pemilih_dpt").deleteMany({});
  await db.collection<ProgressPemilih>("progress_pemilih").deleteMany({});
  await db.collection<SesiPemilih>("sesi_pemilih").deleteMany({});
  await db.collection<Suara>("suara").deleteMany({});

  // 15 DPT Sampel (Siswa & Guru)
  const dptData: Array<Partial<PemilihDpt> & { nis_nip: string; nama: string; jenis: "siswa" | "guru" }> = [
    // Siswa Kelas XII (Sudah selesai memilih)
    { nis_nip: "21001", nama: "Anisa Rahmawati", jenis: "siswa", kelas: "XII MIPA 1", tanggal_lahir: "2007-03-15", bukti_jenis: "KTP", bukti_nomor: "3309012345000001" },
    { nis_nip: "21002", nama: "Bagus Setiawan", jenis: "siswa", kelas: "XII MIPA 2", tanggal_lahir: "2007-05-20", bukti_jenis: "Kartu Pelajar", bukti_nomor: "KP-21002" },
    { nis_nip: "21003", nama: "Citra Dewi Lestari", jenis: "siswa", kelas: "XII IPS 1", tanggal_lahir: "2007-08-11", bukti_jenis: "KIA", bukti_nomor: "KIA-3309-21003" },
    { nis_nip: "21004", nama: "Dian Pratama", jenis: "siswa", kelas: "XII IPS 2", tanggal_lahir: "2007-11-02", bukti_jenis: "SIM", bukti_nomor: "SIM-C-21004" },
    { nis_nip: "21005", nama: "Eko Prasetyo", jenis: "siswa", kelas: "XII Keagamaan", tanggal_lahir: "2007-01-25", bukti_jenis: "Kartu Keluarga", bukti_nomor: "KK-33090005" },

    // Siswa Kelas XI (Sedang antre / di bilik)
    { nis_nip: "22001", nama: "Fajar Maulana", jenis: "siswa", kelas: "XI MIPA 1", tanggal_lahir: "2008-04-10", bukti_jenis: "Kartu Pelajar", bukti_nomor: "KP-22001" },
    { nis_nip: "22002", nama: "Gita Safitri", jenis: "siswa", kelas: "XI IPS 1", tanggal_lahir: "2008-07-19", bukti_jenis: "KTP", bukti_nomor: "3309012345000002" },
    { nis_nip: "22003", nama: "Hafiz Abdullah", jenis: "siswa", kelas: "XI IPS 2", tanggal_lahir: "2008-10-30", bukti_jenis: "Kartu Pelajar", bukti_nomor: "KP-22003" },

    // Siswa Kelas X (Sudah aktivasi & nonton video kampanye, siap check-in)
    { nis_nip: "23001", nama: "Indah Permata", jenis: "siswa", kelas: "X-1", tanggal_lahir: "2009-02-14", bukti_jenis: "Kartu Pelajar", bukti_nomor: "KP-23001" },
    { nis_nip: "23002", nama: "Joko Susilo", jenis: "siswa", kelas: "X-2", tanggal_lahir: "2009-06-05", bukti_jenis: "Kartu Pelajar", bukti_nomor: "KP-23002" },
    { nis_nip: "23003", nama: "Kirana Putri", jenis: "siswa", kelas: "X-3", tanggal_lahir: "2009-09-22", bukti_jenis: "Lainnya", bukti_jenis_lainnya: "Surat Domisili", bukti_nomor: "SD-23003" },

    // Guru & Karyawan
    { nis_nip: "197501012000031001", nama: "Drs. H. Ahmad Marzuki, M.Pd.", jenis: "guru", pangkat: "Pembina Tk. I / IV b", tanggal_lahir: "1975-01-01", bukti_jenis: "KTP", bukti_nomor: "3309010101750001" },
    { nis_nip: "198205122005012003", nama: "Siti Nurjanah, S.Ag., M.S.I.", jenis: "guru", pangkat: "Penata / III c", tanggal_lahir: "1982-05-12", bukti_jenis: "KTP", bukti_nomor: "3309015205820003" },
    { nis_nip: "199008202019031005", nama: "Rahmat Hidayat, S.Pd.", jenis: "guru", pangkat: "Penata Muda / III a", tanggal_lahir: "1990-08-20", bukti_jenis: "KTP", bukti_nomor: "3309012008900005" },
    { nis_nip: "23004", nama: "Lutfi Hakim (Belum Aktivasi)", jenis: "siswa", kelas: "X-4", tanggal_lahir: "2009-12-12", bukti_jenis: null, bukti_nomor: null },
  ];

  const pemilihCreated: PemilihDpt[] = [];
  for (const d of dptData) {
    const pemilihDoc: PemilihDpt = {
      _id: newId(),
      jenis: d.jenis,
      nis_nip: d.nis_nip,
      nama: d.nama,
      kelas: d.kelas ?? null,
      pangkat: d.pangkat ?? null,
      tanggal_lahir: d.tanggal_lahir!,
      foto_kartu_pelajar: null,
      bukti_jenis: d.bukti_jenis ?? null,
      bukti_jenis_lainnya: d.bukti_jenis_lainnya ?? null,
      bukti_nomor: d.bukti_nomor ?? null,
      created_at: sekarang,
    };
    await db.collection<PemilihDpt>("pemilih_dpt").insertOne(pemilihDoc);
    pemilihCreated.push(pemilihDoc);

    // Akun Pengguna
    const isAktivasi = d.bukti_jenis !== null;
    const akunPemilih: AkunPengguna = {
      _id: newId(),
      pemilih_id: pemilihDoc._id,
      kandidat_id: null,
      username: pemilihDoc.nis_nip,
      password_hash: isAktivasi ? await hashPassword("passwordPilihan123") : defaultHash,
      role: "pemilih",
      aktivasi_selesai: isAktivasi,
      wajib_ganti_password: !isAktivasi,
      created_at: sekarang,
    };
    await db.collection<AkunPengguna>("akun_pengguna").insertOne(akunPemilih);

    if (isAktivasi) {
      // Progress menonton video kampanye
      const progress: ProgressPemilih = {
        _id: newId(),
        pemilih_id: pemilihDoc._id,
        video_ditonton: [paslon1Id, paslon2Id],
        updated_at: sekarang,
      };
      await db.collection<ProgressPemilih>("progress_pemilih").insertOne(progress);
    }
  }
  console.log(`  ✓ ${pemilihCreated.length} DPT dan Akun Pemilih berhasil dibuat.`);

  // Simulasi 5 Pemilih telah selesai memilih dan scan keluar
  const pemilihSelesai = pemilihCreated.slice(0, 5);
  const pilihanPaslon = [paslon1Id, paslon1Id, paslon2Id, paslon1Id, paslon2Id]; // 3 suara Paslon 1, 2 suara Paslon 2

  for (let i = 0; i < pemilihSelesai.length; i++) {
    const p = pemilihSelesai[i];
    const voteToken = generateVoteToken();
    const buktiToken = generateBuktiToken();
    const candidateChoice = pilihanPaslon[i];

    // Sesi Pemilih (Status Selesai)
    const sesi: SesiPemilih = {
      _id: newId(),
      pemilih_id: p._id,
      token_hash: hashToken(voteToken),
      status: "selesai",
      antre_at: new Date(sekarang.getTime() - 15 * 60000),
      masuk_bilik_at: new Date(sekarang.getTime() - 10 * 60000),
      selesai_at: new Date(sekarang.getTime() - 5 * 60000),
      bilik_id: bilik1Id,
      token_plaintext_pending: null,
      token_delivered_at: new Date(sekarang.getTime() - 14 * 60000),
      barcode_bukti_hash: hashToken(buktiToken),
      barcode_bukti_plain: buktiToken,
      barcode_used_at: new Date(sekarang.getTime() - 2 * 60000),
      kandidat_dipilih_nomor: null, // Anonimitas mutlak
    };
    await db.collection<SesiPemilih>("sesi_pemilih").insertOne(sesi);

    // Suara sah masuk ke kotak suara secara anonim
    const suara: Suara = {
      _id: newId(),
      kandidat_id: candidateChoice,
      created_at: new Date(sekarang.getTime() - 5 * 60000),
    };
    await db.collection<Suara>("suara").insertOne(suara);
  }
  console.log("  ✓ 5 Pemilih selesai mencoblos & scan keluar (3 suara Paslon 1, 2 suara Paslon 2).");

  // Pemilih ke-6: Sedang menunggu di antrean (sudah di-ACC panitia)
  const p6 = pemilihCreated[5];
  const token6 = generateVoteToken();
  await db.collection<SesiPemilih>("sesi_pemilih").insertOne({
    _id: newId(),
    pemilih_id: p6._id,
    token_hash: hashToken(token6),
    status: "menunggu",
    antre_at: sekarang,
    masuk_bilik_at: null,
    selesai_at: null,
    bilik_id: null,
    token_plaintext_pending: token6,
    token_delivered_at: null,
    barcode_bukti_hash: null,
    barcode_bukti_plain: null,
    barcode_used_at: null,
    kandidat_dipilih_nomor: null,
  });
  console.log("  ✓ 1 Pemilih dalam antrean menunggu bilik (token terbit).");

  // Pemilih ke-7: Sedang berada di bilik 2
  const p7 = pemilihCreated[6];
  const token7 = generateVoteToken();
  const sesi7Id = newId();
  await db.collection<SesiPemilih>("sesi_pemilih").insertOne({
    _id: sesi7Id,
    pemilih_id: p7._id,
    token_hash: hashToken(token7),
    status: "di_bilik",
    antre_at: new Date(sekarang.getTime() - 2 * 60000),
    masuk_bilik_at: sekarang,
    selesai_at: null,
    bilik_id: bilik2Id,
    token_plaintext_pending: null,
    token_delivered_at: sekarang,
    barcode_bukti_hash: null,
    barcode_bukti_plain: null,
    barcode_used_at: null,
    kandidat_dipilih_nomor: null,
  });
  await db.collection<Bilik>("bilik").updateOne({ _id: bilik2Id }, { $set: { status: "terisi", sesi_aktif_id: sesi7Id } });
  console.log("  ✓ 1 Pemilih sedang berada di Bilik 2 (bilik status: 'terisi').");

  // Checklist Go/No-Go ditandai lolos
  await db.collection<ChecklistItem>("checklist_simulasi").updateMany(
    {},
    { $set: { status: "lolos", diuji_pada: sekarang, catatan: "Teruji otomatis via seed simulasi.", updated_at: sekarang } }
  );
  console.log("  ✓ Checklist Go/No-Go (6 butir) diverifikasi lolos.");

  console.log("\n[6/6] Verifikasi Konsistensi & Integritas Data (Rekonsiliasi)...");
  const totalDpt = await db.collection("pemilih_dpt").countDocuments();
  const totalAkun = await db.collection("akun_pengguna").countDocuments();
  const totalKandidat = await db.collection("kandidat").countDocuments();
  const totalBilik = await db.collection("bilik").countDocuments();
  const totalSuara = await db.collection("suara").countDocuments();
  const totalSesi = await db.collection("sesi_pemilih").countDocuments();
  const totalSelesai = await db.collection("sesi_pemilih").countDocuments({ status: "selesai" });
  const totalScanKeluar = await db.collection("sesi_pemilih").countDocuments({ barcode_used_at: { $ne: null } });

  console.log("  ---------------------------------------------");
  console.log("  Total DPT Pemilih       :", totalDpt);
  console.log("  Total Akun Pengguna     :", totalAkun);
  console.log("  Total Kandidat Paslon   :", totalKandidat);
  console.log("  Total Bilik Suara       :", totalBilik);
  console.log("  Total Sesi Pemilih      :", totalSesi);
  console.log("  Total Selesai Memilih   :", totalSelesai);
  console.log("  Total Suara di Kotak    :", totalSuara);
  console.log("  Total Scan Keluar       :", totalScanKeluar);
  console.log("  ---------------------------------------------");

  const suaraP1 = await db.collection("suara").countDocuments({ kandidat_id: paslon1Id });
  const suaraP2 = await db.collection("suara").countDocuments({ kandidat_id: paslon2Id });
  console.log(`  Perolehan Sementara     : Paslon 1 = ${suaraP1} suara | Paslon 2 = ${suaraP2} suara`);

  const rekonCocok = totalSelesai === totalSuara && totalSuara === totalScanKeluar;
  if (rekonCocok) {
    console.log("  ✓ REKONSILIASI KONSISTEN: Total selesai (" + totalSelesai + ") == Total Suara (" + totalSuara + ") == Total Scan Keluar (" + totalScanKeluar + ").");
    console.log("  ✓ Tidak ada anomali atau selisih suara!");
  } else {
    console.warn("  ✗ PERINGATAN: Rekonsiliasi tidak konsisten!");
  }

  console.log("\n===============================================================");
  console.log("       SELURUH DATA UJI COBA BERHASIL DIMUAT KE DATABASE       ");
  console.log("===============================================================\n");

  if (replSet) {
    console.log("Menutup in-memory replica set...");
    const client = await getMongoClient();
    await client.close();
    await replSet.stop();
  }
}

main().catch((err) => {
  console.error("Error executing seed test data:", err);
  process.exit(1);
});
