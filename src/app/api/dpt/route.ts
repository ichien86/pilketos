import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { kandidatWajibDitonton } from "@/lib/eligibility";
import { newId } from "@/lib/id";
import type { AkunPengguna, PemilihDpt, ProgressPemilih } from "@/types";

export const dynamic = "force-dynamic";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

// US-01 -- selain import Excel, panitia/admin bisa tambah/lihat pemilih
// satu-satu (mis. susulan/koreksi kecil tanpa perlu bikin ulang seluruh
// file Excel). Pengawas hanya boleh lihat (read-only).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia", "pengawas"])) return errorJson("Tidak diizinkan", 403);

  const mode = await resolveAppMode();
  const db = await getDb(mode);

  const list = await db
    .collection<PemilihDpt>("pemilih_dpt")
    .find({}, { sort: { nama: 1 } })
    .toArray();

  const akunList = await db
    .collection<AkunPengguna>("akun_pengguna")
    .find({ pemilih_id: { $in: list.map((p) => p._id) } }, { projection: { pemilih_id: 1, aktivasi_selesai: 1 } })
    .toArray();
  const aktivasiByPemilih = new Map(akunList.map((a) => [a.pemilih_id, a.aktivasi_selesai]));

  // "Memenuhi persyaratan pemilih" = sudah menonton video sosialisasi semua
  // paslon wajib (persis logika US-12 di /api/progress dan eligibility.ts,
  // cuma dihitung sekaligus untuk semua pemilih di sini).
  const kandidatWajib = await kandidatWajibDitonton(db);
  const totalWajibTonton = kandidatWajib.length;
  const idKandidatWajib = new Set(kandidatWajib);

  const progressList = await db
    .collection<ProgressPemilih>("progress_pemilih")
    .find({ pemilih_id: { $in: list.map((p) => p._id) } })
    .toArray();
  const progressByPemilih = new Map(
    progressList.map((pr) => [pr.pemilih_id, pr.video_ditonton.filter((id) => idKandidatWajib.has(id)).length])
  );

  return NextResponse.json(
    list.map((p) => ({
      _id: p._id,
      jenis: p.jenis,
      nis_nip: p.nis_nip,
      nama: p.nama,
      kelas: p.kelas,
      pangkat: p.pangkat,
      tanggal_lahir: p.tanggal_lahir,
      aktivasi_selesai: aktivasiByPemilih.get(p._id) ?? false,
      sosialisasi_ditonton: progressByPemilih.get(p._id) ?? 0,
      sosialisasi_wajib: totalWajibTonton,
      memenuhi_syarat: totalWajibTonton === 0 ? null : (progressByPemilih.get(p._id) ?? 0) >= totalWajibTonton,
      sudah_memilih: !!p.sudah_memilih,
    }))
  );
}

export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);

  const mode = await resolveAppMode();
  const fase = await getFase("pendataan");
  if (fase.status === "ditutup") {
    return errorJson("Masa pendataan sudah ditutup -- tidak bisa menambah pemilih baru", 403);
  }

  const body = await req.json().catch(() => null);
  const jenis = body?.jenis;
  const nisNip = typeof body?.nis_nip === "string" ? body.nis_nip.trim() : "";
  const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
  const kelasPangkat = typeof body?.kelas_pangkat === "string" ? body.kelas_pangkat.trim() : "";
  const tanggalLahir = typeof body?.tanggal_lahir === "string" ? body.tanggal_lahir.trim() : "";

  if (jenis !== "siswa" && jenis !== "guru") return errorJson("jenis wajib 'siswa' atau 'guru'", 400);
  if (!nisNip || !nama || !kelasPangkat || !tanggalLahir) {
    return errorJson("nis_nip, nama, kelas_pangkat, dan tanggal_lahir wajib diisi", 400);
  }
  if (!TANGGAL_RE.test(tanggalLahir)) return errorJson("tanggal_lahir wajib format YYYY-MM-DD", 400);

  const db = await getDb(mode);
  const bentrok = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: nisNip });
  if (bentrok) return errorJson(`Nomor identitas sudah terdaftar di sistem: ${nisNip}`, 409);

  const now = new Date();
  const pemilih: PemilihDpt = {
    _id: newId(),
    jenis,
    nis_nip: nisNip,
    nama,
    kelas: jenis === "siswa" ? kelasPangkat : null,
    pangkat: jenis === "guru" ? kelasPangkat : null,
    tanggal_lahir: tanggalLahir,
    foto_kartu_pelajar: null,
    created_at: now,
    bukti_jenis: null,
    bukti_jenis_lainnya: null,
    bukti_nomor: null,
  };
  const defaultPassword = process.env.DEFAULT_PASSWORD ?? "MAN3Byl";
  const akun: AkunPengguna = {
    _id: newId(),
    pemilih_id: pemilih._id,
    kandidat_id: null,
    username: pemilih.nis_nip,
    password_hash: await hashPassword(defaultPassword),
    role: "pemilih",
    aktivasi_selesai: false,
    wajib_ganti_password: true,
    created_at: now,
  };

  await db.collection<PemilihDpt>("pemilih_dpt").insertOne(pemilih);
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(akun);

  return NextResponse.json({ _id: pemilih._id }, { status: 201 });
}
