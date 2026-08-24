import { NextRequest, NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { rejectLoginSessionOnVoteEndpoint } from "@/lib/auth";
import { resolveSesiByVoteToken } from "@/lib/vote-session";
import type { Kandidat } from "@/types";

export const dynamic = "force-dynamic";

// Daftar kandidat aktif untuk layar voting di dalam bilik (US-25).
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ditolak = rejectLoginSessionOnVoteEndpoint(req);
  if (ditolak) return ditolak;

  const { db, sesi } = await resolveSesiByVoteToken(params.token);
  if (!sesi || sesi.status !== "di_bilik") {
    return errorJson("Sesi tidak valid untuk memilih saat ini", 409);
  }

  const list = await db
    .collection<Kandidat>("kandidat")
    .find({ status: "aktif" })
    .sort({ nomor_urut: 1 })
    .toArray();
  return NextResponse.json(
    list.map((k) => ({
      _id: k._id,
      nomor_urut: k.nomor_urut,
      nama_ketua: k.nama_ketua,
      nama_wakil: k.nama_wakil,
      foto_ketua: k.foto_ketua,
      foto_wakil: k.foto_wakil,
      visi: k.visi,
      misi: k.misi,
    }))
  );
}
