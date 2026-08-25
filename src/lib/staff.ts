// Password bersama untuk SEMUA akun panitia/pengawas baru (dan hasil reset) --
// wajib_ganti_password selalu di-set true supaya setiap orang dipaksa ganti
// ke password sendiri di login pertama (lihat /ganti-password), meski
// password awalnya sama dan diketahui banyak orang.
export const DEFAULT_STAFF_PASSWORD = process.env.STAFF_DEFAULT_PASSWORD ?? "panitiapilketosman3";

// Akun "admin" SENGAJA tidak bisa dibuat/direset lewat UI ini (hanya via
// `npm run create-staff` di server) -- peran paling berkuasa tidak boleh
// semudah itu ditambah dari form web, meski form ini sendiri sudah
// dibatasi hanya untuk admin yang sudah login.
export type PeranStaf = "panitia" | "pengawas";
export const PERAN_STAF_BOLEH: PeranStaf[] = ["panitia", "pengawas"];
