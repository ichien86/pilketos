import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, hashPassword, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import { parseDptExcel, type BarisDptError, type BarisDptValid } from "@/lib/dpt-import";
import type { AkunPengguna, PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

// US-01 -- import DPT dari Excel. mode=dry-run (default) hanya memvalidasi;
// mode=commit menulis ke DB + membuat akun_pengguna otomatis per baris.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);

  const appMode = await resolveAppMode();
  if (appMode === "prod") {
    const fase = await getFase("pendataan");
    if (fase.status === "ditutup") {
      return errorJson("Masa pendataan sudah ditutup -- import DPT tidak bisa lagi dilakukan", 403);
    }
  }

  const form = await req.formData().catch(() => null);
  if (!form) return errorJson("Body harus multipart/form-data", 400);
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "dry-run");
  if (!(file instanceof File)) return errorJson("File Excel wajib diunggah", 400);
  if (mode !== "dry-run" && mode !== "commit") return errorJson("mode tidak valid", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { valid, error } = await parseDptExcel(buffer);

  const db = await getDb(appMode);

  // Cek duplikat terhadap data yang SUDAH ada di DB (di luar duplikat di dalam file,
  // yang sudah dicek oleh parseDptExcel).
  const existing = await db
    .collection<PemilihDpt>("pemilih_dpt")
    .find({ nis_nip: { $in: valid.map((v) => v.nis_nip) } }, { projection: { nis_nip: 1 } })
    .toArray();
  const existingSet = new Set(existing.map((e) => e.nis_nip));

  const layakCommit: BarisDptValid[] = [];
  const errorTambahan: BarisDptError[] = [...error];
  for (const row of valid) {
    if (existingSet.has(row.nis_nip)) {
      errorTambahan.push({
        jenis: row.jenis,
        baris: -1,
        pesan: `Nomor identitas sudah terdaftar di sistem: ${row.nis_nip}`,
      });
    } else {
      layakCommit.push(row);
    }
  }

  const ringkasan = {
    total_baris_siswa: valid.filter((v) => v.jenis === "siswa").length + errorTambahan.filter((e) => e.jenis === "siswa").length,
    total_baris_guru: valid.filter((v) => v.jenis === "guru").length + errorTambahan.filter((e) => e.jenis === "guru").length,
    valid: layakCommit.length,
    error: errorTambahan.length,
    detail_error: errorTambahan,
  };

  if (mode === "dry-run") {
    return NextResponse.json({ mode, ringkasan });
  }

  // mode === "commit"
  const defaultPassword = process.env.DEFAULT_PASSWORD ?? "MAN3Byl";
  const defaultHash = await hashPassword(defaultPassword);
  const now = new Date();

  const pemilihDocs: PemilihDpt[] = layakCommit.map((row) => ({
    _id: newId(),
    jenis: row.jenis,
    nis_nip: row.nis_nip,
    nama: row.nama,
    kelas: row.kelas,
    pangkat: row.pangkat,
    tanggal_lahir: row.tanggal_lahir,
    foto_kartu_pelajar: null,
    created_at: now,
  }));
  const akunDocs: AkunPengguna[] = pemilihDocs.map((p) => ({
    _id: newId(),
    pemilih_id: p._id,
    kandidat_id: null,
    username: p.nis_nip,
    password_hash: defaultHash,
    role: "pemilih",
    aktivasi_selesai: false,
    wajib_ganti_password: true,
    created_at: now,
  }));

  if (pemilihDocs.length > 0) {
    await db.collection<PemilihDpt>("pemilih_dpt").insertMany(pemilihDocs);
    await db.collection<AkunPengguna>("akun_pengguna").insertMany(akunDocs);
  }

  return NextResponse.json({
    mode,
    ringkasan: { ...ringkasan, ter_commit: pemilihDocs.length },
  });
}
