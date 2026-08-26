# Deploy ke Fly.io (gratis untuk skala kecil, arsitektur tidak berubah)

Panduan ini memakai `Dockerfile` + `fly.toml` di root repo. Server Next.js dan
proses cron sweep TTL tetap jalan persis seperti di lokal (`npm run start` +
`npm run cron`), cuma dibungkus jadi dua process group di satu app Fly.
MongoDB **tidak** ikut di-deploy ke sini -- pakai MongoDB Atlas (lihat bagian
bawah), yang sudah replica set bawaan tanpa perlu setup apa pun.

## 0. Prasyarat

- Akun Fly.io + kartu pembayaran terpasang (wajib meski masih di kuota gratis).
- [`flyctl`](https://fly.io/docs/flyctl/install/) terinstal, sudah `fly auth login`.
- Cluster MongoDB Atlas (M0 gratis) sudah dibuat, punya connection string
  (`mongodb+srv://...`). Kalau belum, lihat bagian "MongoDB Atlas" di bawah dulu.

## 1. Buat app & volume

```bash
cd /path/ke/pilketos
fly apps create pilketos-nama-sekolah   # sesuaikan, harus unik global
fly volumes create pilketos_uploads --size 1 --region sin
```

`--size 1` = 1GB, cukup untuk video kampanye singkat beberapa paslon. Bisa
diperbesar belakangan dengan `fly volumes extend`.

> Kalau nama app di atas beda dari `pilketos` yang tertulis di `fly.toml`,
> update baris `app = "pilketos"` di `fly.toml` supaya cocok.

## 2. Set secrets (JANGAN taruh di fly.toml atau commit ke git)

```bash
fly secrets set \
  MONGODB_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority" \
  MONGODB_DB_PROD="pilketos_prod" \
  MONGODB_DB_SIMULASI="pilketos_simulasi" \
  AUTH_JWT_SECRET="$(openssl rand -base64 48)" \
  SECRET_CHECKIN="$(openssl rand -base64 48)" \
  DEFAULT_PASSWORD="MAN3Byl"
```

`AUTH_JWT_SECRET` dan `SECRET_CHECKIN` **harus beda satu sama lain** (lihat
Bagian 1 dokumen teknis) -- perintah di atas sudah generate dua nilai acak
terpisah lewat `openssl rand` dua kali.

## 3. Deploy

```bash
fly deploy
```

Ini build `Dockerfile`, jalankan migrasi build Next.js, lalu start dua mesin:
satu untuk process group `app` (kena volume + HTTPS publik), satu untuk
`cron` (jalan di background, tidak menerima traffic dari luar).

Cek status:

```bash
fly status
fly logs
```

## 4. Siapkan data awal

Setelah deploy pertama sukses, jalankan setup index + checklist Go/No-Go +
lima dokumen fase langsung di mesin yang sudah punya akses ke Atlas:

```bash
fly ssh console -C "npm run setup-db"
```

Lalu buat akun admin pertama:

```bash
fly ssh console -C "npm run create-admin -- admin1 PasswordKuatAnda123"
```

Untuk akun panitia (panitia pemilihan) dan pengawas (panitia pengawas,
akses read-only -- lihat rekonsiliasi & pantauan bilik, tidak bisa
ACC/scan/ubah data apa pun), admin yang sudah login bisa kelola sendiri
lewat `/admin/panitia` (tambah akun baru, reset password, hapus) --
password awal semua akun baru sama (`panitiapilketosman3`, atau nilai env
`STAFF_DEFAULT_PASSWORD` kalau di-set), setiap orang wajib menggantinya
sendiri di login pertama.

Script CLI di server hanya perlu dipakai kalau butuh akses langsung tanpa
lewat browser (mis. tidak ada admin yang bisa login):

```bash
fly ssh console -C "npm run create-staff -- panitia panitia1 PasswordKuat123"
fly ssh console -C "npm run create-staff -- pengawas pengawas1 PasswordKuat456"
```

Jalankan perintah yang sama kapan saja untuk reset password akun yang sudah
ada (kalau username-nya sudah dipakai akun dengan peran yang sama, script
menimpa password-nya, bukan menolak).

Jalankan perintah yang sama kapan saja untuk reset password admin yang sudah
ada (kalau username-nya sudah dipakai akun admin, script ini menimpa
password-nya, bukan menolak).

## 5. Domain & HTTPS

`https://pilketos-nama-sekolah.fly.dev` otomatis dapat sertifikat TLS --
tidak perlu setup apa pun, dan langsung menuntaskan syarat HTTPS untuk scan
kamera (barcode identitas, QR bilik, barcode bukti). Domain kustom sekolah
bisa ditambahkan lewat `fly certs add nama-domain.sch.id` kalau perlu.

## 6. Update setelah ganti kode

```bash
fly deploy
```

Volume `pilketos_uploads` (video kampanye) tidak ikut terhapus saat deploy
ulang -- hanya kode aplikasinya yang berganti.

---

## MongoDB Atlas (kalau belum ada)

1. Buat akun di [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas),
   buat cluster **M0** (gratis, sudah replica set bawaan -- transaksi klaim
   bilik & submit vote langsung jalan tanpa konfigurasi tambahan).
2. **Database Access** -> buat user baru, beri role `readWrite` di database
   `pilketos_prod` dan `pilketos_simulasi`.
   - Opsional tapi disarankan: tambahkan role `dbAdmin` **hanya** di-scope ke
     `pilketos_simulasi` (bukan `pilketos_prod`) supaya user aplikasi secara
     fisik tidak bisa menjalankan `dropDatabase()` di data produksi, walau
     ada bug di kode. Kode hanya pernah memanggil `dropDatabase()` pada
     database simulasi (`src/lib/mode.ts`, saat mode uji coba dinyalakan/dimatikan).
3. **Network Access** -> karena Fly.io tidak punya IP keluar yang tetap,
   tambahkan `0.0.0.0/0` (semua IP). Ini standar untuk platform serverless/
   container tanpa IP statis -- keamanan tetap terjaga lewat username+password
   yang kuat di connection string, bukan IP allowlist.
4. **Connect** -> pilih "Drivers", salin connection string `mongodb+srv://...`,
   pakai di `fly secrets set MONGODB_URI=...` (Langkah 2 di atas).

---

## Catatan arsitektur

- **Satu mesin `app` saja** -- volume Fly (`pilketos_uploads`) menempel ke
  satu mesin fisik, jadi jangan menaikkan `min_machines_running` untuk
  process group `app` di atas 1 selama upload video masih ke disk lokal.
  Untuk skala satu sekolah ini bukan masalah; kalau nanti butuh multi-mesin,
  itulah saatnya pindah ke object storage (lihat rencana Vercel Blob
  sebelumnya) -- bukan sebelum itu perlu.
- Proses `cron` jalan terus-menerus (tidak auto-stop) karena tidak terdaftar
  di `[[services]]` -- cocok dengan desain aslinya sebagai proses terpisah
  yang selalu hidup.
