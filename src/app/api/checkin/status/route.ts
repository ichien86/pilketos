import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { expireSesiIfNeeded } from "@/lib/ttl";
import type { SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// Keputusan desain #1 -- pemilih app polling status pakai SESI LOGIN (bukan
// voteToken, karena voteToken belum ada sampai panitia ACC). Sesi login di
// sini murni jadi kurir pengantar voteToken sekali kirim, bukan pengganti
// otentikasi voting -- voteToken tetap satu-satunya kredensial untuk
// klaim-bilik/submit (lihat rejectLoginSessionOnVoteEndpoint di lib/auth.ts).
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["pemilih"]) || !claims.pemilihId) {
    return errorJson("Tidak diizinkan", 401);
  }

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return NextResponse.json({ status: "belum_checkin" });
    throw e;
  }

  const db = await getDb(mode);
  let sesi = await db
    .collection<SesiPemilih>("sesi_pemilih")
    .findOne({ pemilih_id: claims.pemilihId }, { sort: { antre_at: -1 } });
  if (!sesi) return NextResponse.json({ status: "belum_checkin" });

  sesi = await expireSesiIfNeeded(db, sesi);

  let voteToken: string | null = null;
  if (
    sesi.status === "menunggu" ||
    sesi.status === "di_bilik" ||
    sesi.status === "sudah_memilih" ||
    sesi.status === "selesai"
  ) {
    voteToken = sesi.token_plaintext_pending;
    if (voteToken && !sesi.token_delivered_at) {
      await db.collection<SesiPemilih>("sesi_pemilih").updateOne(
        { _id: sesi._id },
        { $set: { token_delivered_at: new Date() } }
      );
    }
  }

  return NextResponse.json({
    status: sesi.status,
    voteToken, // hanya terisi SEKALI, di respons polling pertama setelah ACC
    bilikId: sesi.bilik_id,
  });
}
