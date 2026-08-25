import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getFase } from "@/lib/fase-gate";
import type { KontrolFase } from "@/types";

export const dynamic = "force-dynamic";

// Gerbang terpisah dari status fase "pemilihan" sendiri -- admin tutup
// pemilihan dulu (hentikan voting), cek rekonsiliasi, BARU umumkan ke
// pemilih kapan siap. Mengumumkan HANYA boleh setelah fase resmi ditutup;
// batalkan pengumuman boleh kapan saja (mis. salah umum, perlu investigasi
// ulang) -- lihat juga reset otomatis di fase/pemilihan/buka saat reopen darurat.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const umumkan = body?.umumkan !== false; // default true kalau body kosong

  const fase = await getFase("pemilihan");
  if (umumkan && fase.status !== "ditutup") {
    return errorJson("Fase pemilihan harus ditutup dulu sebelum hasil bisa diumumkan", 409);
  }

  const db = await getDb("prod");
  await db.collection<KontrolFase>("kontrol_fase").updateOne(
    { nama_fase: "pemilihan" },
    { $set: { hasil_diumumkan: umumkan, hasil_diumumkan_at: umumkan ? new Date() : null } }
  );

  const updated = await db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: "pemilihan" });
  return NextResponse.json(updated);
}
