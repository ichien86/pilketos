import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as bukaFase } from "@/app/api/fase/[nama]/buka/route";
import { POST as tutupFase } from "@/app/api/fase/[nama]/tutup/route";
import { POST as tambahDpt, GET as listDpt } from "@/app/api/dpt/route";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { resolveAppMode } from "@/lib/fase-gate";
import type { PemilihDpt } from "@/types";

function adminCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "admin", username: "admin1" });
  return `pilketos_session=${token}`;
}

function bukaReq(nama: string) {
  return new NextRequest(`http://localhost/api/fase/${nama}/buka`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie() },
    body: JSON.stringify({}),
  });
}
function tutupReq(nama: string) {
  return new NextRequest(`http://localhost/api/fase/${nama}/tutup`, {
    method: "POST",
    headers: { cookie: adminCookie() },
  });
}
function dptTambahReq() {
  return new NextRequest("http://localhost/api/dpt", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie() },
    body: JSON.stringify({
      jenis: "siswa",
      nis_nip: "UJI001",
      nama: "Pemilih Uji Coba",
      kelas_pangkat: "XII-UJI",
      tanggal_lahir: "2008-01-01",
    }),
  });
}
function dptListReq() {
  return new NextRequest("http://localhost/api/dpt", { headers: { cookie: adminCookie() } });
}

describe("mode uji coba (fase simulasi jadi sandbox semua fitur)", () => {
  it("bisa dibuka langsung TANPA pendataan/pendaftaran_calon/sosialisasi selesai dulu", async () => {
    // Sengaja TIDAK seed fase apa pun -- semuanya "belum_dibuka" dari awal,
    // persis kondisi sebelum sekolah mulai memakai aplikasi ini.
    const res = await bukaFase(bukaReq("simulasi"), { params: { nama: "simulasi" } });
    expect(res.status).toBe(200);
    expect(await resolveAppMode()).toBe("simulasi");
  });

  it("bisa ditutup lalu dibuka lagi berkali-kali TANPA force/konfirmasi darurat", async () => {
    await bukaFase(bukaReq("simulasi"), { params: { nama: "simulasi" } });
    const tutupRes = await tutupFase(tutupReq("simulasi"), { params: { nama: "simulasi" } });
    expect(tutupRes.status).toBe(200);

    // Reopen -- fase lain masih "belum_dibuka" (bukan siklus real), dan status
    // simulasi sendiri sekarang "ditutup". Fase produksi lain butuh force=true
    // untuk skenario ini (lihat acc.test.ts pola serupa) -- simulasi TIDAK.
    const res2 = await bukaFase(bukaReq("simulasi"), { params: { nama: "simulasi" } });
    expect(res2.status).toBe(200);
  });

  it("DPT yang ditambah selama mode uji coba masuk ke database simulasi, bukan prod", async () => {
    await bukaFase(bukaReq("simulasi"), { params: { nama: "simulasi" } });

    const tambahRes = await tambahDpt(dptTambahReq());
    expect(tambahRes.status).toBe(201);

    const listRes = await listDpt(dptListReq());
    const daftar = await listRes.json();
    expect(daftar.some((p: { nis_nip: string }) => p.nis_nip === "UJI001")).toBe(true);

    const prodDb = await getDb("prod");
    const diProd = await prodDb.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: "UJI001" });
    expect(diProd).toBeNull();
  });

  it("semua data uji coba hilang total begitu fase simulasi ditutup", async () => {
    await bukaFase(bukaReq("simulasi"), { params: { nama: "simulasi" } });
    await tambahDpt(dptTambahReq());

    await tutupFase(tutupReq("simulasi"), { params: { nama: "simulasi" } });

    // Setelah ditutup, mode kembali "prod" -- daftar DPT yang kelihatan lewat
    // endpoint yang sama sekarang harus database prod (kosong, tidak ada
    // sisa data UJI001 manapun).
    const listRes = await listDpt(dptListReq());
    const daftar = await listRes.json();
    expect(daftar.some((p: { nis_nip: string }) => p.nis_nip === "UJI001")).toBe(false);
  });
});
