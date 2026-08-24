import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { rejectLoginSessionOnVoteEndpoint } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { hashToken, generateBuktiToken } from "@/lib/voteToken";
import { isSesiExpired } from "@/lib/ttl";
import { newId } from "@/lib/id";
import type { Bilik, Kandidat, SesiPemilih, Suara } from "@/types";

export const dynamic = "force-dynamic";

// Setara Bagian 6.1 v3.0/v4.0 + Bagian 4.4 v6.0 -- submit vote atomik:
// suara tercatat ANONIM (tanpa pemilih_id/sesi_id), sesi terkunci, DAN
// bilik otomatis dilepas, semua dalam satu transaksi yang tidak bisa
// gagal setengah-setengah (US-14 AC).
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ditolak = rejectLoginSessionOnVoteEndpoint(req);
  if (ditolak) return ditolak;

  const body = await req.json().catch(() => null);
  const kandidatId = typeof body?.kandidatId === "string" ? body.kandidatId : "";
  if (!kandidatId) return errorJson("kandidatId wajib diisi", 400);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const tokenHash = hashToken(params.token);
  const buktiToken = generateBuktiToken();

  try {
    await withTransaction(mode, async (db, session) => {
      const sesi = await db
        .collection<SesiPemilih>("sesi_pemilih")
        .findOne({ token_hash: tokenHash }, { session });
      if (!sesi || sesi.status !== "di_bilik") throw new Error("SESI_TIDAK_VALID");
      if (isSesiExpired(sesi)) throw new Error("SESI_KEDALUWARSA");

      const kandidat = await db
        .collection<Kandidat>("kandidat")
        .findOne({ _id: kandidatId, status: "aktif" }, { session });
      if (!kandidat) throw new Error("KANDIDAT_TIDAK_VALID");

      await db.collection<Suara>("suara").insertOne(
        { _id: newId(), kandidat_id: kandidatId, created_at: new Date() },
        { session }
      );

      await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
        { _id: sesi._id },
        {
          $set: {
            status: "sudah_memilih",
            selesai_at: new Date(),
            barcode_bukti_hash: hashToken(buktiToken),
            barcode_bukti_plain: buktiToken,
          },
        },
        { session }
      );

      if (sesi.bilik_id) {
        await db.collection<Bilik>("bilik").updateOne(
          { _id: sesi.bilik_id, sesi_aktif_id: sesi._id },
          { $set: { status: "kosong", sesi_aktif_id: null } },
          { session }
        );
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SESI_TIDAK_VALID") return errorJson("Sesi tidak valid untuk submit saat ini", 409);
    if (msg === "SESI_KEDALUWARSA") return errorJson("Sesi sudah kedaluwarsa, ulangi dari check-in", 410);
    if (msg === "KANDIDAT_TIDAK_VALID") return errorJson("Kandidat tidak valid/tidak aktif", 400);
    throw e;
  }

  return NextResponse.json({ berhasil: true, buktiToken });
}
