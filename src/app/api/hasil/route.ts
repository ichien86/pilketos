import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";
import { getFase, resolveAppMode } from "@/lib/fase-gate";
import type { Kandidat, Suara } from "@/types";

export const dynamic = "force-dynamic";

// Hasil untuk pemilih (bukan admin/panitia) -- cuma tampil kalau admin
// sudah eksplisit umumkan (lihat /api/fase/pemilihan/umumkan-hasil), dan
// cuma tally per-paslon, TANPA angka rekonsiliasi internal (token terbit,
// dll -- itu tetap khusus /api/admin/rekonsiliasi). Mode-aware supaya
// pemilih uji coba melihat hasil sandbox-nya sendiri, bukan hasil produksi.
export async function GET(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!claims) return errorJson("Tidak diizinkan", 401);

  const mode = await resolveAppMode();
  const fase = await getFase("pemilihan");
  if (!fase.hasil_diumumkan) {
    return NextResponse.json({ diumumkan: false });
  }

  const db = await getDb(mode);
  const [perPaslonAgg, kandidatList] = await Promise.all([
    db
      .collection<Suara>("suara")
      .aggregate<{ _id: string; jumlah: number }>([{ $group: { _id: "$kandidat_id", jumlah: { $sum: 1 } } }])
      .toArray(),
    db.collection<Kandidat>("kandidat").find({ status: { $ne: "dibatalkan" } }).sort({ nomor_urut: 1 }).toArray(),
  ]);
  const jumlahByKandidat = new Map(perPaslonAgg.map((p) => [p._id, p.jumlah]));

  const perPaslon = kandidatList.map((k) => ({
    kandidat_id: k._id,
    nomor_urut: k.nomor_urut,
    nama_ketua: k.nama_ketua,
    nama_wakil: k.nama_wakil,
    foto_ketua: k.foto_ketua,
    foto_wakil: k.foto_wakil,
    jumlah_suara: jumlahByKandidat.get(k._id) ?? 0,
  }));

  const jumlahAbstain = jumlahByKandidat.get("abstain") ?? 0;
  const totalSuara = perPaslon.reduce((sum, p) => sum + p.jumlah_suara, 0) + jumlahAbstain;

  return NextResponse.json({
    diumumkan: true,
    diumumkan_at: fase.hasil_diumumkan_at,
    total_suara: totalSuara,
    jumlah_abstain: jumlahAbstain,
    per_paslon: perPaslon,
  });
}
