import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import { newId } from "@/lib/id";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// US-06 -- buat kandidat baru (status draft). Dibatasi ke masa pendaftaran
// calon supaya kandidat+video-nya siap sebelum tenggat (US-10 AC).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const mode = await resolveAppMode();
  if (mode === "prod") {
    const fasePendaftaran = await getFase("pendaftaran_calon");
    if (fasePendaftaran.status !== "aktif") {
      return errorJson("Kandidat baru hanya bisa didaftarkan selama masa pendaftaran calon aktif", 403);
    }
  }

  const body = await req.json().catch(() => null);
  const nomorUrut = Number(body?.nomor_urut);
  if (!Number.isInteger(nomorUrut) || nomorUrut <= 0) {
    return errorJson("nomor_urut wajib bilangan bulat positif", 400);
  }

  const db = await getDb(mode);
  const bentrok = await db
    .collection<Kandidat>("kandidat")
    .findOne({ nomor_urut: nomorUrut, status: { $ne: "dibatalkan" } });
  if (bentrok) return errorJson("Nomor urut sudah dipakai kandidat lain", 409);

  const now = new Date();
  const doc: Kandidat = {
    _id: newId(),
    nomor_urut: nomorUrut,
    nama_ketua: typeof body?.nama_ketua === "string" ? body.nama_ketua : "",
    nama_wakil: typeof body?.nama_wakil === "string" ? body.nama_wakil : "",
    foto_ketua: typeof body?.foto_ketua === "string" ? body.foto_ketua : null,
    foto_wakil: typeof body?.foto_wakil === "string" ? body.foto_wakil : null,
    visi: typeof body?.visi === "string" ? body.visi : null,
    misi: typeof body?.misi === "string" ? body.misi : null,
    status: "draft",
    dibatalkan_at: null,
    created_at: now,
    updated_at: now,
  };
  await db.collection<Kandidat>("kandidat").insertOne(doc);
  return NextResponse.json(doc, { status: 201 });
}

// Daftar kandidat -- pemilih hanya melihat yang berstatus aktif;
// panitia/admin/pengawas melihat semua status (pengawas read-only, jadi
// cuma diberi visibilitas lebih di GET ini, tidak di endpoint tulis mana pun).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  const db = await getDb(await resolveAppMode());
  const isPengelola = claims && (claims.role === "panitia" || claims.role === "admin" || claims.role === "pengawas");
  const filter: import("mongodb").Filter<Kandidat> = isPengelola ? {} : { status: "aktif" };
  const list = await db
    .collection<Kandidat>("kandidat")
    .find(filter)
    .sort({ nomor_urut: 1 })
    .toArray();
  return NextResponse.json(list);
}
