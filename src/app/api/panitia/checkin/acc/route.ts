import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveHariHMode, FaseGateError } from "@/lib/fase-gate";
import { hitungLolosSyarat } from "@/lib/eligibility";
import { generateVoteToken, hashToken } from "@/lib/voteToken";
import { newId } from "@/lib/id";
import type { AkunPengguna, SesiPemilih } from "@/types";

export const dynamic = "force-dynamic";

// Bagian 3 langkah 2 -- ACC, aksi TERPISAH yang ditekan panitia SETELAH
// mencocokkan dokumen fisik secara manual. Validasi syarat diulang di sini
// (jangan percaya hasil langkah 1 / parameter dari klien).
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["panitia", "admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const pemilihId = typeof body?.pemilihId === "string" ? body.pemilihId : "";
  if (!pemilihId) return errorJson("pemilihId wajib diisi", 400);

  let mode;
  try {
    mode = await resolveHariHMode();
  } catch (e) {
    if (e instanceof FaseGateError) return errorJson(e.message, 409);
    throw e;
  }

  const db = await getDb(mode);
  const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ pemilih_id: pemilihId });
  const lolosSyarat = await hitungLolosSyarat(db, pemilihId, akun);
  if (!lolosSyarat) {
    return errorJson("Belum memenuhi syarat -- tidak ada pengecualian", 403);
  }

  const sesiAktifSebelumnya = await db.collection<SesiPemilih>("sesi_pemilih").findOne({
    pemilih_id: pemilihId,
    status: { $in: ["menunggu", "di_bilik", "sudah_memilih", "selesai"] },
  });
  if (sesiAktifSebelumnya) {
    return errorJson("Sudah pernah di-ACC hari ini", 409);
  }

  const voteToken = generateVoteToken();
  const doc: SesiPemilih = {
    _id: newId(),
    pemilih_id: pemilihId,
    token_hash: hashToken(voteToken),
    status: "menunggu",
    antre_at: new Date(),
    masuk_bilik_at: null,
    selesai_at: null,
    bilik_id: null,
    token_plaintext_pending: voteToken, // dihapus setelah terkirim sekali lewat polling (keputusan desain #1)
    token_delivered_at: null,
    barcode_bukti_hash: null,
    barcode_bukti_plain: null,
    barcode_used_at: null,
    kandidat_dipilih_nomor: null,
  };
  await db.collection<SesiPemilih>("sesi_pemilih").insertOne(doc);

  // voteToken dikirim di sini untuk ditampilkan panitia sbg QR fallback, DAN
  // tersedia lewat polling /api/checkin/status (keputusan desain #1) untuk HP pemilih.
  return NextResponse.json({ voteToken });
}
