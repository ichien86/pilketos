import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as bukaFase } from "@/app/api/fase/[nama]/buka/route";
import { POST as tutupFase } from "@/app/api/fase/[nama]/tutup/route";
import { POST as tambahDpt, GET as listDpt } from "@/app/api/dpt/route";
import { POST as tambahKandidat } from "@/app/api/kandidat/route";
import { GET as getModeUjiCoba, POST as setModeUjiCoba } from "@/app/api/mode/uji-coba/route";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
import { resolveAppMode } from "@/lib/mode";
import { getDb } from "@/lib/db";
import type { PemilihDpt, Kandidat } from "@/types";

function adminCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "admin", username: "admin1" });
  return `pilketos_session=${token}`;
}
function panitiaCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "panitia", username: "panitia1" });
  return `pilketos_session=${token}`;
}

function modeReq(aktif: boolean, cookie = adminCookie()) {
  return new NextRequest("http://localhost/api/mode/uji-coba", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ aktif }),
  });
}
function bukaReq(nama: string, cookie = adminCookie()) {
  return new NextRequest(`http://localhost/api/fase/${nama}/buka`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({}),
  });
}
function tutupReq(nama: string) {
  return new NextRequest(`http://localhost/api/fase/${nama}/tutup`, { method: "POST", headers: { cookie: adminCookie() } });
}
async function buka(nama: string) {
  return bukaFase(bukaReq(nama), { params: { nama } });
}
async function tutup(nama: string) {
  return tutupFase(tutupReq(nama), { params: { nama } });
}
function dptTambahReq(cookie = panitiaCookie()) {
  return new NextRequest("http://localhost/api/dpt", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      jenis: "siswa",
      nis_nip: "UJI001",
      nama: "Pemilih Uji Coba",
      kelas_pangkat: "XII-UJI",
      tanggal_lahir: "2008-01-01",
    }),
  });
}
function dptListReq(cookie = panitiaCookie()) {
  return new NextRequest("http://localhost/api/dpt", { headers: { cookie } });
}
function kandidatTambahReq(cookie = panitiaCookie()) {
  return new NextRequest("http://localhost/api/kandidat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ nomor_urut: 1, nama_ketua: "Ketua Uji", nama_wakil: "Wakil Uji" }),
  });
}

describe("mode uji coba (flag global, bukan fase tersendiri)", () => {
  it("hanya admin yang boleh menyalakan/mematikan", async () => {
    const res = await setModeUjiCoba(modeReq(true, panitiaCookie()));
    expect(res.status).toBe(403);
  });

  it("menyala -> resolveAppMode() jadi simulasi; mati -> kembali prod", async () => {
    expect(await resolveAppMode()).toBe("prod");

    await setModeUjiCoba(modeReq(true));
    expect(await resolveAppMode()).toBe("simulasi");

    await setModeUjiCoba(modeReq(false));
    expect(await resolveAppMode()).toBe("prod");
  });

  it("status GET mencerminkan flag tanpa perlu login", async () => {
    await setModeUjiCoba(modeReq(true));
    const res = await getModeUjiCoba();
    const body = await res.json();
    expect(body.aktif).toBe(true);
  });

  it("saat uji coba aktif, fase TETAP harus dibuka berurutan -- tidak ada jalan pintas", async () => {
    await setModeUjiCoba(modeReq(true));

    // Loncat ke pendaftaran_calon tanpa pendataan dibuka+ditutup dulu -> ditolak,
    // persis seperti aturan produksi biasa.
    const res = await buka("pendaftaran_calon");
    expect(res.status).toBe(409);

    // Buka pendataan dulu -> berhasil (di sandbox, karena mode aktif).
    const resPendataan = await buka("pendataan");
    expect(resPendataan.status).toBe(200);
  });

  it("kandidat tidak bisa didaftarkan sebelum fase pendaftaran_calon sandbox aktif -- gerbang tetap ditegakkan", async () => {
    await setModeUjiCoba(modeReq(true));

    const ditolak = await tambahKandidat(kandidatTambahReq());
    expect(ditolak.status).toBe(403);

    await buka("pendataan");
    await tutup("pendataan");
    await buka("pendaftaran_calon");

    const berhasil = await tambahKandidat(kandidatTambahReq());
    expect(berhasil.status).toBe(201);

    const prodDb = await getDb("prod");
    const diProd = await prodDb.collection<Kandidat>("kandidat").findOne({ nama_ketua: "Ketua Uji" });
    expect(diProd).toBeNull();
  });

  it("DPT yang ditambah selama mode uji coba masuk ke database simulasi, bukan prod", async () => {
    await setModeUjiCoba(modeReq(true));
    await buka("pendataan");

    const berhasil = await tambahDpt(dptTambahReq());
    expect(berhasil.status).toBe(201);

    const listRes = await listDpt(dptListReq());
    const daftar = await listRes.json();
    expect(daftar.some((p: { nis_nip: string }) => p.nis_nip === "UJI001")).toBe(true);

    const prodDb = await getDb("prod");
    const diProd = await prodDb.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: "UJI001" });
    expect(diProd).toBeNull();
  });

  it("mematikan mode uji coba mereset SEMUA data termasuk status kelima fase", async () => {
    await setModeUjiCoba(modeReq(true));
    await buka("pendataan");
    await tambahDpt(dptTambahReq());
    await tutup("pendataan");

    await setModeUjiCoba(modeReq(false));

    // Nyalakan lagi -- harus mulai dari nol lagi (pendataan "belum_dibuka"),
    // bukan meneruskan status "ditutup" dari sesi uji coba sebelumnya.
    await setModeUjiCoba(modeReq(true));
    const res = await buka("pendaftaran_calon");
    expect(res.status).toBe(409); // pendataan lagi-lagi belum dibuka -> masih harus berurutan dari awal

    const listRes = await listDpt(dptListReq());
    const daftar = await listRes.json();
    expect(daftar.some((p: { nis_nip: string }) => p.nis_nip === "UJI001")).toBe(false);
  });
});
