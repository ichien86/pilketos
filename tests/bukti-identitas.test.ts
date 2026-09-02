import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as aktivasi } from "@/app/api/akun/aktivasi/route";
import { GET as getBukti, PUT as putBukti } from "@/app/api/akun/bukti-identitas/route";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { hashPassword, signSession } from "@/lib/auth";
import { seedPemilih } from "./helpers";
import type { AkunPengguna, KontrolFase, PemilihDpt } from "@/types";

async function seedPendataanAktif() {
  const db = await getDb("prod");
  await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
  await db.collection<KontrolFase>("kontrol_fase").insertOne({
    _id: newId(),
    nama_fase: "pendataan",
    status: "aktif",
    dibuka_at: new Date(),
    ditutup_at: null,
    kandidat_terkunci: null,
    hasil_diumumkan: false,
    hasil_diumumkan_at: null,
  });
}

async function seedAkunBelumAktivasi(pemilih: PemilihDpt) {
  const db = await getDb("prod");
  const akun: AkunPengguna = {
    _id: newId(),
    pemilih_id: pemilih._id,
    kandidat_id: null,
    username: pemilih.nis_nip,
    password_hash: await hashPassword("MAN3Byl"),
    role: "pemilih",
    aktivasi_selesai: false,
    wajib_ganti_password: true,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(akun);
  return akun;
}

function aktivasiReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/akun/aktivasi", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function loginCookie(pemilihId: string): string {
  const token = signSession({ akunId: newId(), pemilihId, kandidatId: null, role: "pemilih", username: "test" });
  return `pilketos_session=${token}`;
}

describe("bukti dukung (bukti diri hari-H) -- diisi wajib saat aktivasi, bisa diubah sebelum check-in", () => {
  beforeEach(async () => {
    await seedPendataanAktif();
  });

  it("aktivasi ditolak tanpa bukti_jenis/bukti_nomor", async () => {
    const pemilih = await seedPemilih({ nis_nip: "B001", tanggal_lahir: "2008-01-01" });
    await seedAkunBelumAktivasi(pemilih);

    const res = await aktivasi(
      aktivasiReq({
        username: "B001",
        password: "MAN3Byl",
        tanggal_lahir: "2008-01-01",
        password_baru: "passwordbaru123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("aktivasi ditolak kalau jenis 'Lainnya' tanpa nama dokumen", async () => {
    const pemilih = await seedPemilih({ nis_nip: "B002", tanggal_lahir: "2008-01-01" });
    await seedAkunBelumAktivasi(pemilih);

    const res = await aktivasi(
      aktivasiReq({
        username: "B002",
        password: "MAN3Byl",
        tanggal_lahir: "2008-01-01",
        password_baru: "passwordbaru123",
        bukti_jenis: "Lainnya",
        bukti_nomor: "12345",
      })
    );
    expect(res.status).toBe(400);
  });

  it("aktivasi berhasil dengan bukti diri lengkap -- tersimpan di pemilih_dpt", async () => {
    const pemilih = await seedPemilih({ nis_nip: "B003", tanggal_lahir: "2008-01-01" });
    await seedAkunBelumAktivasi(pemilih);

    const res = await aktivasi(
      aktivasiReq({
        username: "B003",
        password: "MAN3Byl",
        tanggal_lahir: "2008-01-01",
        password_baru: "passwordbaru123",
        bukti_jenis: "KTP",
        bukti_nomor: "3301xxxx",
      })
    );
    expect(res.status).toBe(200);

    const db = await getDb("prod");
    const updated = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: pemilih._id });
    expect(updated?.bukti_jenis).toBe("KTP");
    expect(updated?.bukti_nomor).toBe("3301xxxx");
  });

  it("pemilih bisa mengubah bukti dirinya sendiri lewat GET/PUT, tanpa tersentuh gerbang fase", async () => {
    const pemilih = await seedPemilih({
      nis_nip: "B004",
      bukti_jenis: "SIM",
      bukti_jenis_lainnya: null,
      bukti_nomor: "SIM-001",
    });
    const cookie = loginCookie(pemilih._id);

    const getRes = await getBukti(new NextRequest("http://localhost/api/akun/bukti-identitas", { headers: { cookie } }));
    const before = await getRes.json();
    expect(before.bukti_jenis).toBe("SIM");

    const putRes = await putBukti(
      new NextRequest("http://localhost/api/akun/bukti-identitas", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ bukti_jenis: "Lainnya", bukti_jenis_lainnya: "Surat Domisili", bukti_nomor: "SD-99" }),
      })
    );
    expect(putRes.status).toBe(200);

    const db = await getDb("prod");
    const updated = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: pemilih._id });
    expect(updated?.bukti_jenis).toBe("Lainnya");
    expect(updated?.bukti_jenis_lainnya).toBe("Surat Domisili");
    expect(updated?.bukti_nomor).toBe("SD-99");
  });

  it("non-pemilih (mis. tidak login) ditolak akses bukti-identitas", async () => {
    const res = await getBukti(new NextRequest("http://localhost/api/akun/bukti-identitas"));
    expect(res.status).toBe(403);
  });

  it("aktivasi TETAP bisa dilakukan meskipun masa pendataan sudah ditutup dan pemilihan (hari-H) aktif", async () => {
    const db = await getDb("prod");
    await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
    await db.collection<KontrolFase>("kontrol_fase").insertMany([
      {
        _id: newId(),
        nama_fase: "pendataan",
        status: "ditutup",
        dibuka_at: new Date(),
        ditutup_at: new Date(),
        kandidat_terkunci: null,
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      },
      {
        _id: newId(),
        nama_fase: "pemilihan",
        status: "aktif",
        dibuka_at: new Date(),
        ditutup_at: null,
        kandidat_terkunci: null,
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      },
    ]);

    const pemilih = await seedPemilih({ nis_nip: "B005", tanggal_lahir: "2008-01-01" });
    await seedAkunBelumAktivasi(pemilih);

    const res = await aktivasi(
      aktivasiReq({
        username: "B005",
        password: "MAN3Byl",
        tanggal_lahir: "2008-01-01",
        password_baru: "passwordbaru123",
        bukti_jenis: "Kartu Pelajar",
        bukti_nomor: "KP-005",
      })
    );
    expect(res.status).toBe(200);

    const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username: "B005" });
    expect(akun?.aktivasi_selesai).toBe(true);
    expect(akun?.wajib_ganti_password).toBe(false);
  });

  it("aktivasi ditolak jika pendataan belum pernah dibuka", async () => {
    const db = await getDb("prod");
    await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
    await db.collection<KontrolFase>("kontrol_fase").insertOne({
      _id: newId(),
      nama_fase: "pendataan",
      status: "belum_dibuka",
      dibuka_at: null,
      ditutup_at: null,
      kandidat_terkunci: null,
      hasil_diumumkan: false,
      hasil_diumumkan_at: null,
    });

    const pemilih = await seedPemilih({ nis_nip: "B006", tanggal_lahir: "2008-01-01" });
    await seedAkunBelumAktivasi(pemilih);

    const res = await aktivasi(
      aktivasiReq({
        username: "B006",
        password: "MAN3Byl",
        tanggal_lahir: "2008-01-01",
        password_baru: "passwordbaru123",
        bukti_jenis: "Kartu Pelajar",
        bukti_nomor: "KP-006",
      })
    );
    expect(res.status).toBe(403);
  });
});
