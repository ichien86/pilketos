import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { POST as importDpt } from "@/app/api/dpt/import/route";
import { GET as listDpt } from "@/app/api/dpt/route";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { signSession, verifyPassword } from "@/lib/auth";
import type { AkunPengguna, KontrolFase, PemilihDpt } from "@/types";

interface SiswaRow {
  nis: string;
  nama: string;
  kelas: string;
  tgl: string; // format apa adanya, ditulis sebagai string ke sel Excel
}
interface GuruRow {
  nip: string;
  nama: string;
  pangkat: string;
  tgl: string;
}

async function buildWorkbook(opts: { siswa?: SiswaRow[]; guru?: GuruRow[] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const siswaSheet = wb.addWorksheet("Siswa");
  siswaSheet.addRow(["NIS", "Nama", "Kelas", "Tanggal Lahir"]);
  for (const r of opts.siswa ?? []) siswaSheet.addRow([r.nis, r.nama, r.kelas, r.tgl]);

  const guruSheet = wb.addWorksheet("Guru");
  guruSheet.addRow(["NIP", "Nama", "Pangkat", "Tanggal Lahir"]);
  for (const r of opts.guru ?? []) guruSheet.addRow([r.nip, r.nama, r.pangkat, r.tgl]);

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

function panitiaCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "panitia", username: "panitia1" });
  return `pilketos_session=${token}`;
}
function pemilihCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: newId(), kandidatId: null, role: "pemilih", username: "p1" });
  return `pilketos_session=${token}`;
}

function importReq(buffer: Buffer, mode: "dry-run" | "commit", cookie = panitiaCookie()) {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(buffer)], "dpt.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  form.set("mode", mode);
  return new NextRequest("http://localhost/api/dpt/import", {
    method: "POST",
    headers: { cookie },
    body: form,
  });
}

// Fitur ini sebelumnya TIDAK punya tes otomatis sama sekali -- xlsx yang
// sesungguhnya (bukan mock parser) diproses lewat ExcelJS baik saat dibuat
// (di sini) maupun saat dibaca (lib/dpt-import.ts), supaya alur upload asli
// panitia benar-benar teruji, bukan cuma asumsi format kolom cocok.
describe("import DPT dari Excel (dry-run + commit)", () => {
  it("dry-run: baris valid dihitung benar, kolom kosong & duplikat-dalam-file jadi error, format tanggal DD/MM/YYYY diterima", async () => {
    const buffer = await buildWorkbook({
      siswa: [
        { nis: "S001", nama: "Andi", kelas: "XII-1", tgl: "2008-01-01" },
        { nis: "S002", nama: "Budi", kelas: "XII-2", tgl: "01/02/2008" }, // DD/MM/YYYY
        { nis: "", nama: "Tanpa NIS", kelas: "XII-3", tgl: "2008-01-01" }, // kolom wajib kosong
        { nis: "S001", nama: "Andi Duplikat", kelas: "XII-4", tgl: "2008-01-01" }, // duplikat NIS dalam file
      ],
      guru: [{ nip: "G001", nama: "Pak Guru", pangkat: "Pembina", tgl: "1980-05-05" }],
    });

    const res = await importDpt(importReq(buffer, "dry-run"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.mode).toBe("dry-run");
    expect(body.ringkasan.valid).toBe(3); // S001, S002, G001
    expect(body.ringkasan.error).toBe(2); // NIS kosong + duplikat dalam file
    expect(body.ringkasan.detail_error.some((e: { pesan: string }) => e.pesan.includes("duplikat"))).toBe(true);

    // dry-run TIDAK menulis apa pun ke database
    const db = await getDb("prod");
    const count = await db.collection<PemilihDpt>("pemilih_dpt").countDocuments({});
    expect(count).toBe(0);
  });

  it("commit: menulis pemilih_dpt + akun_pengguna dengan password default & bukti diri masih kosong", async () => {
    const buffer = await buildWorkbook({
      siswa: [{ nis: "S010", nama: "Citra", kelas: "XI-1", tgl: "2009-03-03" }],
      guru: [],
    });

    const res = await importDpt(importReq(buffer, "commit"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ringkasan.ter_commit).toBe(1);

    const db = await getDb("prod");
    const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: "S010" });
    expect(pemilih?.nama).toBe("Citra");
    expect(pemilih?.kelas).toBe("XI-1");
    expect(pemilih?.tanggal_lahir).toBe("2009-03-03");
    expect(pemilih?.bukti_jenis).toBeNull();

    const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ pemilih_id: pemilih!._id });
    expect(akun?.username).toBe("S010");
    expect(akun?.aktivasi_selesai).toBe(false);
    expect(await verifyPassword(process.env.DEFAULT_PASSWORD ?? "MAN3Byl", akun!.password_hash)).toBe(true);

    const listRes = await listDpt(new NextRequest("http://localhost/api/dpt", { headers: { cookie: panitiaCookie() } }));
    const daftar = await listRes.json();
    expect(daftar.some((p: { nis_nip: string }) => p.nis_nip === "S010")).toBe(true);
  });

  it("commit menolak baris yang NIS/NIP-nya sudah ada di database (bukan cuma duplikat dalam file)", async () => {
    const db = await getDb("prod");
    await db.collection<PemilihDpt>("pemilih_dpt").insertOne({
      _id: newId(),
      jenis: "siswa",
      nis_nip: "S020",
      nama: "Sudah Ada",
      kelas: "X-1",
      pangkat: null,
      tanggal_lahir: "2010-01-01",
      foto_kartu_pelajar: null,
      created_at: new Date(),
      bukti_jenis: null,
      bukti_jenis_lainnya: null,
      bukti_nomor: null,
    });

    const buffer = await buildWorkbook({
      siswa: [{ nis: "S020", nama: "Nama Baru", kelas: "X-2", tgl: "2010-02-02" }],
    });

    const res = await importDpt(importReq(buffer, "commit"));
    const body = await res.json();
    expect(body.ringkasan.ter_commit).toBe(0);
    expect(body.ringkasan.error).toBe(1);

    const masihLama = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: "S020" });
    expect(masihLama?.nama).toBe("Sudah Ada");
  });

  it("ditolak kalau fase pendataan sudah ditutup", async () => {
    const db = await getDb("prod");
    await db.collection<KontrolFase>("kontrol_fase").insertOne({
      _id: newId(),
      nama_fase: "pendataan",
      status: "ditutup",
      dibuka_at: new Date(),
      ditutup_at: new Date(),
      kandidat_terkunci: null,
      hasil_diumumkan: false,
      hasil_diumumkan_at: null,
    });

    const buffer = await buildWorkbook({ siswa: [{ nis: "S030", nama: "Telat", kelas: "X-1", tgl: "2010-01-01" }] });
    const res = await importDpt(importReq(buffer, "commit"));
    expect(res.status).toBe(403);
  });

  it("ditolak untuk role selain admin/panitia", async () => {
    const buffer = await buildWorkbook({ siswa: [{ nis: "S040", nama: "X", kelas: "X-1", tgl: "2010-01-01" }] });
    const res = await importDpt(importReq(buffer, "dry-run", pemilihCookie()));
    expect(res.status).toBe(403);
  });
});
