import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { newId } from "@/lib/id";
import type { Bilik } from "@/types";

export const dynamic = "force-dynamic";

// Bagian 4.2 / US-26 -- konfigurasi jumlah bilik FISIK produksi. Selalu di
// database produksi (bilik simulasi dikelola otomatis oleh siklus hidup
// fase simulasi, lihat lib/simulasi.ts) -- admin bisa menyiapkan ini kapan
// saja sebelum hari-H, tidak terikat fase mana yang sedang aktif.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const nomorBilik = Number(body?.nomor_bilik);
  if (!Number.isInteger(nomorBilik) || nomorBilik <= 0) {
    return errorJson("nomor_bilik wajib bilangan bulat positif", 400);
  }

  const db = await getDb("prod");
  const bentrok = await db.collection<Bilik>("bilik").findOne({ nomor_bilik: nomorBilik });
  if (bentrok) return errorJson("Nomor bilik sudah dipakai", 409);

  const doc: Bilik = {
    _id: newId(),
    nomor_bilik: nomorBilik,
    qr_hash: `bilik-${nomorBilik}-${newId()}`,
    status: "kosong",
    sesi_aktif_id: null,
    created_at: new Date(),
  };
  await db.collection<Bilik>("bilik").insertOne(doc);
  return NextResponse.json(doc, { status: 201 });
}

export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) return errorJson("Tidak diizinkan", 403);
  const db = await getDb("prod");
  const list = await db.collection<Bilik>("bilik").find({}).sort({ nomor_bilik: 1 }).toArray();
  return NextResponse.json(list);
}
