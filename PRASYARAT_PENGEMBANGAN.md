# Prasyarat Pengembangan & Operasional
## Sistem E-Voting Pemilihan Ketua & Wakil Ketua OSIM — MAN 3 Boyolali

Dokumen ini melengkapi Dokumen Teknis v4–v6 dan User Stories v4. Isinya murni **prasyarat** —
apa yang harus tersedia/disiapkan supaya sistem ini bisa dikembangkan, diuji, dan dijalankan
dengan aman di hari-H. Bukan dokumentasi fitur (lihat dua dokumen sumber untuk itu).

---

## 1. Prasyarat Teknis (Development)

| Kebutuhan | Detail | Alasan |
|---|---|---|
| Node.js | v20 LTS ke atas | Next.js 14 App Router butuh Node ≥18.17; disarankan 20 LTS. |
| MongoDB | **v6+, WAJIB berjalan sebagai replica set** (bukan standalone) | Klaim bilik (Bagian 4.3) dan submit vote (Bagian 6.1) memakai multi-document transaction — Mongo standalone tidak mendukung transaksi sama sekali. `docker-compose.yml` di repo ini sudah mengatur replica set 1-node untuk development. |
| HTTPS atau localhost | Untuk semua device yang melakukan scan kamera (panitia & pemilih) | `getUserMedia` (API kamera browser, dipakai `html5-qrcode`) diblokir browser modern di koneksi HTTP biasa selain `localhost`. Deployment hari-H **wajib** di belakang HTTPS (reverse proxy + sertifikat, atau tunnel HTTPS) kalau diakses lewat jaringan lokal berbeda perangkat. |
| Storage disk lokal | `UPLOAD_DIR` (default `./public/uploads`) | Video kampanye (US-10) disimpan di disk lokal server, bukan object storage — batasan sadar untuk skala sekolah. Pastikan disk punya ruang cukup (video singkat × jumlah paslon) dan **di-backup** kalau server di-redeploy. |
| Environment variables | Lihat `.env.example` | `AUTH_JWT_SECRET` dan `SECRET_CHECKIN` **harus berbeda satu sama lain**, acak (≥32 karakter), dan berbeda antara environment dev/simulasi/produksi. |

### Menjalankan development

```bash
cp .env.example .env.local        # isi secret acak (openssl rand -base64 48)
docker compose up -d              # Mongo replica set lokal
npm install
npm run setup-db                  # index + checklist Go/No-Go + dokumen 5 fase
npm run dev                       # aplikasi web
npm run cron                      # (proses terpisah) sweep TTL bilik/sesi tiap 30 detik
```

> Catatan lingkungan sandbox: kalau Docker di mesin Anda tidak bisa start container Mongo
> (mis. sandbox tanpa izin `clone(CLONE_THREAD)`), gunakan `mongodb-memory-server` (sudah
> jadi dev-dependency, dipakai `npm run test`) sebagai pengganti sementara — itulah yang
> dipakai untuk memverifikasi seluruh alur di dokumen ini selama pengembangan.

---

## 2. Prasyarat Perangkat Hari-H

| Titik | Kebutuhan perangkat | Catatan |
|---|---|---|
| Meja pendaftaran (check-in) | 1 device + kamera per panitia pendaftaran, browser modern (Chrome/Safari terbaru) | Dipakai untuk scan barcode identitas (Bagian 2–3). |
| Bilik suara | QR statis **tercetak & dilaminating**, ditempel permanen di tiap bilik fisik | Dibuat lewat halaman Admin → Bilik (`/admin/bilik`), qr_hash unik per bilik. |
| Pemilih | HP/tablet pribadi dengan browser modern + kamera | Untuk menampilkan barcode identitas, scan QR bilik, dan menampilkan barcode bukti. Siapkan beberapa unit cadangan (mis. tablet sekolah) untuk pemilih yang tidak bawa HP. |
| Pintu keluar | 1 device + kamera per panitia keluar | Scan barcode bukti (US-16). |
| Layar pantauan bilik | 1 device (bisa proyektor/TV) menampilkan `/panitia/bilik-monitor` | Opsional tapi sangat disarankan untuk koordinasi antrean. |
| Jaringan lokal | Wi-Fi sekolah dengan kapasitas untuk seluruh device terhubung bersamaan | Uji beban ini adalah bagian dari checklist Go/No-Go (`beban_registrasi`). |
| **Koneksi cadangan** | Hotspot/koneksi internet kedua sebagai fallback | US-20 mewajibkan pengujian skenario "koneksi utama diputus" selama fase simulasi — siapkan jalur cadangan **sebelum** hari-H, bukan saat itu juga. |

---

## 3. Prasyarat Data

- **Format Excel DPT** (US-01): sheet `Siswa` dengan kolom header persis `NIS`, `Nama`, `Kelas`, `Tanggal Lahir`; sheet `Guru` dengan `NIP`, `Nama`, `Pangkat`, `Tanggal Lahir`. Kolom tanggal lahir boleh berupa sel tanggal Excel asli, atau teks dalam salah satu format: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, atau `DD <Nama Bulan> YYYY` (nama bulan Indonesia atau Inggris, penuh maupun singkatan -- mis. "17 Agustus 2008" atau "17 Aug 2008"). Tanggal yang tidak masuk akal (mis. 31 Februari) maupun format lain di luar daftar ini ditolak sebagai error per baris, bukan ditebak. Baris dengan kolom kosong atau NIS/NIP duplikat ditolak saat commit.
- **Password default** (`DEFAULT_PASSWORD`, default `MAN3Byl`): sama untuk semua akun pemilih sebelum aktivasi — **wajib** diganti sebelum masa pendataan dimulai kalau nilai default ini pernah bocor ke publik sebelumnya.
- **Foto referensi** (opsional): kolom `foto_kartu_pelajar` di `pemilih_dpt` bisa diisi manual lewat proses import lanjutan kalau panitia ingin foto ikut tampil di layar scan (Bagian 3) — tidak wajib untuk MVP.
- **Minimal 2 kandidat aktif** sebelum fase `sosialisasi` maupun `pemilihan` bisa dibuka (gerbang otomatis, lihat US-08 AC).
- **Bukti diri hari-H**: saat aktivasi, pemilih wajib mengisi jenis dokumen (KTP/KIA/Kartu Pelajar/SIM/Kartu Keluarga/Lainnya dengan nama bebas) + nomornya -- dipakai panitia check-in untuk tahu di muka apa yang harus dicocokkan, dan ditampilkan sebagai pengingat + menu ubah di dashboard pemilih sebelum check-in hari-H. Pemilih boleh mengubah data ini sendiri kapan saja lewat `/api/akun/bukti-identitas`, termasuk saat hari-H.
- **Prosedur baris DPT yang ditolak saat import Excel** (bukan all-or-nothing): jalankan Dry-run dulu untuk melihat daftar error per baris (nomor baris + penyebab), perbaiki langsung di file Excel, upload ulang. Saat Commit, baris valid tetap masuk walau ada baris lain error -- baris error dilewati, tidak menggagalkan seluruh proses maupun menimpa data lama. File boleh diupload ulang berkali-kali: baris yang sudah ter-commit otomatis ditolak lagi sebagai "sudah terdaftar" (aman, dilewati, tidak dobel). Error karena bentrok dengan data yang SUDAH ada di database bukan untuk diperbaiki lewat re-import -- itu sengaja supaya tidak menimpa data lama; pakai tombol Edit di tabel Daftar Pemilih. Untuk satu-dua baris yang tetap bermasalah, lebih cepat pakai form "Tambah Pemilih Manual" langsung.

---

## 4. Prasyarat Proses & Urutan Operasional

1. Fase **wajib** dibuka berurutan: `pendataan` → `pendaftaran_calon` → `sosialisasi` → `pemilihan`. Tidak bisa melompat (lihat `/admin/fase`). Urutan ini berlaku SAMA PERSIS baik untuk produksi maupun mode uji coba (lihat poin 3) — mode uji coba tidak melompati urutan ini, cuma memindahkan datanya (termasuk status kelima fase itu sendiri) ke database terpisah.
2. **Checklist Go/No-Go** (US-21, dicentang panitia di `/panitia/checklist`, dipantau read-only di `/admin/fase`) — 6 item (beban registrasi, integritas transaksi vote, barcode sekali pakai, rekonsiliasi konsisten, koneksi cadangan, isolasi data uji coba) **harus semua lolos** sebelum fase `pemilihan` bisa dibuka. Tidak ada jalur pengecualian di kode.
3. **Mode Uji Coba / gladi bersih (Epic 6)** — bukan fase tersendiri, melainkan flag global (`/admin/fase`, `src/lib/mode.ts`) yang menentukan apakah proses fase yang sedang dijalankan itu untuk uji coba atau produksi sungguhan. Wajib dijalankan minimal sekali sebelum hari-H sungguhan, dengan skenario gagal disengaja (scan barcode dua kali, submit vote bersamaan dari token sama, putus koneksi di tengah proses) — ini yang mengisi checklist di atas dengan bukti nyata, bukan asumsi. Mematikan mode ini menghapus TOTAL database sandboxnya, termasuk status kelima fase di atas.
4. Reopen fase yang sudah ditutup (skenario darurat) butuh konfirmasi ganda di UI dan flag `force=true` di API — dipakai **hanya** untuk keadaan darurat, bukan alur normal.
5. Password reset (US-04) dan reset apa pun yang menyentuh status aktivasi **selalu tercatat log** (`reset_log`) — jangan hapus log ini secara manual.

---

## 5. Rencana Pengujian (ringkasan, detail penuh di Bagian 7 Dokumen Teknis v6 & US-20)

Checklist otomatis yang **sudah** diverifikasi di repo ini (`npm run test`, `tests/`):

- Race condition klaim bilik — dua sesi klaim bilik sama nyaris bersamaan → hanya satu berhasil.
- Pemisahan token — endpoint voting menolak sesi login pemilih, hanya menerima `voteToken`.
- Cegah ACC ganda — pemilih yang sama tidak bisa di-ACC dua kali di hari yang sama.
- Submit vote atomik — suara anonim (tanpa `pemilih_id`), bilik otomatis lepas, dalam satu transaksi.
- Barcode bukti sekali pakai — scan kedua pada barcode yang sama ditolak & dicatat anomali.
- Rekonsiliasi konsisten — total token terbit / sudah memilih / suara / scan keluar saling cocok.
- TTL dua lapis — sesi `menunggu` (60 menit) dan `di_bilik` (5 menit) kedaluwarsa sesuai batasnya masing-masing, dan `di_bilik` yang kedaluwarsa melepas bilik otomatis.

Yang **masih perlu diuji manual** saat gladi bersih (tidak bisa diotomasi penuh di CI):

- Beban registrasi sungguhan dengan banyak device fisik sekaligus.
- Pengalaman scan kamera di kondisi pencahayaan lokasi hari-H yang sesungguhnya.
- Putus-sambung koneksi utama → jalur cadangan sungguhan.
- Isolasi data simulasi vs produksi diverifikasi manual (cek nama database berbeda, drop simulasi tidak menyentuh produksi).

---

## 6. Batasan yang Disengaja (bukan bug)

- Video kampanye di disk lokal, bukan CDN/object storage — cukup untuk skala satu sekolah.
- `voteToken` dan `barcode bukti` disimpan sebagai hash di database; nilai plaintext hanya
  sempat tersimpan sementara di `sesi_pemilih.token_plaintext_pending` sampai terkirim sekali
  ke pemilih lewat polling, lalu dihapus. Barcode bukti plaintext (`barcode_bukti_plain`)
  sengaja disimpan permanen (bukan cuma hash) supaya pemilih bisa memuat ulang QR-nya kapan
  saja (US-15) — ini aman karena barcode bukti **tidak membawa informasi pilihan**, hanya
  bukti "sesi ini sudah memilih", setara tanda terima kertas fisik.
- Next.js 14.2.35 (rilis terbaru di jalur 14.x) masih membawa beberapa advisory keamanan level
  framework yang belum ada patch di jalur 14.x (kebanyakan terkait Server Actions/Edge
  Middleware/Image Optimizer — fitur yang **tidak dipakai** aplikasi ini). Untuk deployment
  yang akan diekspos ke internet publik (bukan jaringan sekolah lokal), evaluasi upgrade ke
  Next.js 15/16 sebelum go-live.
