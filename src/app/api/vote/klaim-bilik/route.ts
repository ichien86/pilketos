import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { rejectLoginSessionOnVoteEndpoint } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { hashToken } from "@/lib/voteToken";
import { isSesiExpired } from "@/lib/ttl";
import type { Bilik, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// Bagian 4.3 -- klaim bilik atomik. HANYA voteToken, sesi login DITOLAK
// (Bagian 7 rencana pengujian: dua jalur otentikasi harus benar-benar terpisah).
export async function POST(req: NextRequest) {
  const ditolak = rejectLoginSessionOnVoteEndpoint(req);
  if (ditolak) return ditolak;

  const body = await req.json().catch(() => null);
  const voteToken = typeof body?.voteToken === "string" ? body.voteToken : "";
  const qrBilikHash = typeof body?.qrBilikHash === "string" ? body.qrBilikHash : "";
  if (!voteToken || !qrBilikHash) return errorJson("voteToken dan qrBilikHash wajib diisi", 400);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const tokenHash = hashToken(voteToken);

  try {
    await withTransaction(mode, async (db, session) => {
      const sesi = await db
        .collection<SesiPemilih>("sesi_pemilih")
        .findOne({ token_hash: tokenHash, status: "menunggu" }, { session });
      if (!sesi) throw new Error("SESI_TIDAK_VALID");
      if (isSesiExpired(sesi)) throw new Error("SESI_KEDALUWARSA");

      const bilik = await db.collection<Bilik>("bilik").findOneAndUpdate(
        { qr_hash: qrBilikHash, status: "kosong" },
        { $set: { status: "terisi", sesi_aktif_id: sesi._id } },
        { session, returnDocument: "after" }
      );
      if (!bilik) throw new Error("BILIK_TERISI");

      await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
        { _id: sesi._id },
        { $set: { status: "di_bilik", bilik_id: bilik._id, masuk_bilik_at: new Date() } },
        { session }
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SESI_TIDAK_VALID") return errorJson("Sesi tidak valid / bukan status menunggu", 409);
    if (msg === "SESI_KEDALUWARSA") return errorJson("Sesi sudah kedaluwarsa, ulangi dari check-in", 410);
    if (msg === "BILIK_TERISI") return errorJson("Bilik sudah terisi orang lain, coba bilik lain", 409);
    throw e;
  }

  return NextResponse.json({ berhasil: true });
}
