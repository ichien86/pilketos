import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase } from "@/lib/fase-gate";
import type { AkunPengguna, PemilihDpt } from "@/types";

export const dynamic = "force-dynamic";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

async function guardPendataanAktif() {
  const fase = await getFase("pendataan");
  if (fase.status === "ditutup") {
    return errorJson("Masa pendataan sudah ditutup -- data pemilih tidak bisa lagi diubah", 403);
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const gagalGate = await guardPendataanAktif();
  if (gagalGate) return gagalGate;

  const db = await getDb("prod");
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: params.id });
  if (!pemilih) return errorJson("Data pemilih tidak ditemukan", 404);
  const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ pemilih_id: pemilih._id });

  const body = await req.json().catch(() => null);
  const nisNip = typeof body?.nis_nip === "string" ? body.nis_nip.trim() : pemilih.nis_nip;
  const nama = typeof body?.nama === "string" ? body.nama.trim() : pemilih.nama;
  const kelasPangkat =
    typeof body?.kelas_pangkat === "string" ? body.kelas_pangkat.trim() : (pemilih.kelas ?? pemilih.pangkat ?? "");
  const tanggalLahir = typeof body?.tanggal_lahir === "string" ? body.tanggal_lahir.trim() : pemilih.tanggal_lahir;

  if (!nisNip || !nama || !kelasPangkat || !tanggalLahir) {
    return errorJson("nis_nip, nama, kelas_pangkat, dan tanggal_lahir wajib diisi", 400);
  }
  if (!TANGGAL_RE.test(tanggalLahir)) return errorJson("tanggal_lahir wajib format YYYY-MM-DD", 400);

  if (nisNip !== pemilih.nis_nip) {
    if (akun?.aktivasi_selesai) {
      return errorJson("Nomor identitas tidak bisa diubah -- akun pemilih ini sudah pernah diaktivasi", 409);
    }
    const bentrok = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ nis_nip: nisNip, _id: { $ne: pemilih._id } });
    if (bentrok) return errorJson(`Nomor identitas sudah terdaftar di sistem: ${nisNip}`, 409);
  }

  await db.collection<PemilihDpt>("pemilih_dpt").updateOne(
    { _id: pemilih._id },
    {
      $set: {
        nis_nip: nisNip,
        nama,
        kelas: pemilih.jenis === "siswa" ? kelasPangkat : null,
        pangkat: pemilih.jenis === "guru" ? kelasPangkat : null,
        tanggal_lahir: tanggalLahir,
      },
    }
  );
  if (akun && nisNip !== pemilih.nis_nip) {
    await db.collection<AkunPengguna>("akun_pengguna").updateOne({ _id: akun._id }, { $set: { username: nisNip } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const gagalGate = await guardPendataanAktif();
  if (gagalGate) return gagalGate;

  const db = await getDb("prod");
  const pemilih = await db.collection<PemilihDpt>("pemilih_dpt").findOne({ _id: params.id });
  if (!pemilih) return errorJson("Data pemilih tidak ditemukan", 404);

  await db.collection<PemilihDpt>("pemilih_dpt").deleteOne({ _id: pemilih._id });
  await db.collection<AkunPengguna>("akun_pengguna").deleteOne({ pemilih_id: pemilih._id });

  return NextResponse.json({ ok: true });
}
