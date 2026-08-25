// Tipe bersama untuk seluruh koleksi MongoDB & payload API.
// Mengikuti skema di Dokumen Teknis v4/v5/v6 dan User Stories v4.

// "pengawas" -- panitia pengawas, akses read-only murni (rekonsiliasi,
// pantauan bilik, checklist Go/No-Go) untuk pemisahan wewenang dari
// "panitia" (panitia pemilihan) yang bisa ACC/scan/ubah data.
export type Peran = "admin" | "panitia" | "pemilih" | "kandidat" | "pengawas";

export type StatusFase =
  | "pendataan"
  | "pendaftaran_calon"
  | "sosialisasi"
  | "simulasi"
  | "pemilihan";

export type StatusKandidat = "draft" | "aktif" | "dibatalkan";
export type StatusVideo = "draft" | "aktif";
export type StatusSesiPemilih =
  | "menunggu"
  | "di_bilik"
  | "sudah_memilih"
  | "selesai"
  | "kedaluwarsa";
export type StatusBilik = "kosong" | "terisi";

export interface PemilihDpt {
  _id: string;
  jenis: "siswa" | "guru";
  nis_nip: string;
  nama: string;
  kelas: string | null; // siswa
  pangkat: string | null; // guru
  tanggal_lahir: string; // ISO date (YYYY-MM-DD)
  foto_kartu_pelajar: string | null;
  created_at: Date;
}

export interface AkunPengguna {
  _id: string;
  pemilih_id: string | null; // null untuk akun kandidat/admin/panitia
  kandidat_id: string | null;
  username: string; // NIS/NIP untuk pemilih
  password_hash: string;
  role: Peran;
  aktivasi_selesai: boolean;
  wajib_ganti_password: boolean;
  created_at: Date;
}

export interface ProfilOpsional {
  _id: string;
  pemilih_id: string;
  alamat: string | null;
  hobi: string | null;
  updated_at: Date;
}

export interface Kandidat {
  _id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
  visi: string | null;
  misi: string | null;
  status: StatusKandidat;
  dibatalkan_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface VideoKampanye {
  _id: string;
  kandidat_id: string;
  url: string;
  status: StatusVideo;
  created_at: Date;
  published_at: Date | null;
}

export interface ProgressPemilih {
  _id: string;
  pemilih_id: string;
  video_ditonton: string[]; // kandidat_id[]
  updated_at: Date;
}

export interface KontrolFase {
  _id: string;
  nama_fase: StatusFase;
  status: "belum_dibuka" | "aktif" | "ditutup";
  dibuka_at: Date | null;
  ditutup_at: Date | null;
  kandidat_terkunci: string[] | null; // snapshot saat sosialisasi dibuka
  // Hanya bermakna untuk nama_fase "pemilihan" -- gerbang terpisah dari
  // status fase sendiri supaya admin bisa tutup pemilihan dulu (hentikan
  // voting), verifikasi rekonsiliasi, BARU umumkan ke pemilih kapan siap.
  hasil_diumumkan: boolean;
  hasil_diumumkan_at: Date | null;
}

export interface SesiPemilih {
  _id: string;
  pemilih_id: string;
  token_hash: string;
  status: StatusSesiPemilih;
  antre_at: Date;
  masuk_bilik_at: Date | null;
  selesai_at: Date | null;
  bilik_id: string | null;
  token_plaintext_pending: string | null; // keputusan desain #1, dihapus setelah terkirim sekali
  token_delivered_at: Date | null; // keputusan desain #1
  barcode_bukti_hash: string | null;
  barcode_bukti_plain: string | null; // dipakai untuk render ulang QR di layar pemilih (US-15) -- lihat catatan lib/voteToken.ts
  barcode_used_at: Date | null;
  kandidat_dipilih_nomor: number | null; // hanya dipakai internal cron/debug, TIDAK pernah diexpose ke client bareng pemilih_id
}

export interface Bilik {
  _id: string;
  nomor_bilik: number;
  qr_hash: string;
  status: StatusBilik;
  sesi_aktif_id: string | null;
  created_at: Date;
}

export interface Suara {
  _id: string;
  kandidat_id: string;
  created_at: Date;
  // SENGAJA tidak ada pemilih_id / sesi_id -- anonimitas (FR-02)
}

export interface ResetLog {
  _id: string;
  pemilih_id: string;
  direset_oleh: string; // akun_pengguna._id panitia/admin
  created_at: Date;
}

export interface ChecklistItem {
  _id: string;
  kode: string;
  label: string;
  lolos: boolean;
  catatan: string | null;
  updated_at: Date;
}

export interface AnomaliScan {
  _id: string;
  jenis: "barcode_bukti_reused" | "barcode_identitas_expired";
  sesi_id: string | null;
  created_at: Date;
  detail: string;
}

export const TTL_MENUNGGU_MS = 60 * 60 * 1000; // 60 menit (Bag. 5)
export const TTL_DI_BILIK_MS = 5 * 60 * 1000; // 5 menit (Bag. 5)
export const CHECKIN_BARCODE_TTL_MS = 90 * 1000; // Bag. 2

export const URUTAN_FASE: StatusFase[] = [
  "pendataan",
  "pendaftaran_calon",
  "sosialisasi",
  "simulasi",
  "pemilihan",
];
