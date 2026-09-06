import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import type { Bilik, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// Endpoint Reset Darurat Bilik Suara:
// Digunakan oleh panitia/admin jika pemilih meninggalkan bilik tanpa submit suara,
// atau terjadi kendala perangkat HP di dalam bilik fisik.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin", "panitia"])) {
    return errorJson("Tidak diizinkan. Pengawas hanya memiliki hak pantau.", 403);
  }

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const bilikId = params.id;
  if (!bilikId) return errorJson("ID bilik wajib disertakan", 400);

  try {
    await withTransaction(mode, async (db, session) => {
      const bilik = await db
        .collection<Bilik>("bilik")
        .findOne({ _id: bilikId }, { session });

      if (!bilik) throw new Error("BILIK_NOT_FOUND");

      // Jika bilik sedang memiliki sesi aktif yang mengunci, tandai sesi tersebut kedaluwarsa
      if (bilik.sesi_aktif_id) {
        await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
          { _id: bilik.sesi_aktif_id },
          { $set: { status: "kedaluwarsa", selesai_at: new Date() } },
          { session }
        );
      }

      // Kembalikan status bilik ke kosong
      await db.collection<Bilik>("bilik").updateOne(
        { _id: bilikId },
        { $set: { status: "kosong", sesi_aktif_id: null } },
        { session }
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BILIK_NOT_FOUND") return errorJson("Bilik tidak ditemukan", 404);
    throw e;
  }

  return NextResponse.json({ berhasil: true, pesan: "Bilik berhasil direset menjadi kosong" });
}
