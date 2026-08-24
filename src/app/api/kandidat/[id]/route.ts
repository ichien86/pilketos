import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

const FIELDS_EDITABLE = ["nama_ketua", "nama_wakil", "foto_ketua", "foto_wakil", "visi", "misi", "nomor_urut"] as const;

// US-06 -- edit field kandidat, HANYA selama status masih draft.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const db = await getDb("prod");
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);
  if (kandidat.status !== "draft") {
    return errorJson("Kandidat yang sudah dipublish/dibatalkan tidak bisa diedit bebas lagi", 409);
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  for (const f of FIELDS_EDITABLE) {
    if (body && f in body) {
      if (f === "nomor_urut") {
        const n = Number(body[f]);
        if (!Number.isInteger(n) || n <= 0) return errorJson("nomor_urut tidak valid", 400);
        update[f] = n;
      } else {
        update[f] = typeof body[f] === "string" ? body[f] : null;
      }
    }
  }
  if ("nomor_urut" in update) {
    const bentrok = await db.collection<Kandidat>("kandidat").findOne({
      _id: { $ne: params.id },
      nomor_urut: update.nomor_urut as number,
      status: { $ne: "dibatalkan" },
    });
    if (bentrok) return errorJson("Nomor urut sudah dipakai kandidat lain", 409);
  }
  update.updated_at = new Date();

  await db.collection<Kandidat>("kandidat").updateOne({ _id: params.id }, { $set: update });
  const updated = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  return NextResponse.json(updated);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb("prod");
  const kandidat = await db.collection<Kandidat>("kandidat").findOne({ _id: params.id });
  if (!kandidat) return errorJson("Kandidat tidak ditemukan", 404);
  return NextResponse.json(kandidat);
}
