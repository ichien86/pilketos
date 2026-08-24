import { NextRequest, NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { rejectLoginSessionOnVoteEndpoint } from "@/lib/auth";
import { resolveSesiByVoteToken } from "@/lib/vote-session";

export const dynamic = "force-dynamic";

// US-15 -- pulihkan status/barcode bukti kalau koneksi sempat putus.
// Read-only murni: TIDAK PERNAH membuat suara baru.
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ditolak = rejectLoginSessionOnVoteEndpoint(req);
  if (ditolak) return ditolak;

  const { sesi } = await resolveSesiByVoteToken(params.token);
  if (!sesi) return errorJson("Sesi tidak ditemukan", 404);

  return NextResponse.json({
    status: sesi.status,
    bilikId: sesi.bilik_id,
    buktiQrPayload:
      sesi.status === "sudah_memilih" || sesi.status === "selesai"
        ? sesi.barcode_bukti_plain
        : null,
    buktiSudahDiscan: !!sesi.barcode_used_at,
  });
}
