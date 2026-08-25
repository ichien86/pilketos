import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { getAllFase, urutanIndex } from "@/lib/fase-gate";
import { seedSimulasi } from "@/lib/simulasi";
import type { ChecklistItem, Kandidat, KontrolFase, StatusFase } from "@/types";
import { URUTAN_FASE } from "@/types";

export const dynamic = "force-dynamic";

// US-18 -- buka fase secara manual & berurutan; reopen (mundur) butuh force=true
// (dikonfirmasi dua kali di UI) sebagai skenario darurat.
// US-21 -- fase "pemilihan" tidak bisa dibuka kalau ada item checklist Go/No-Go belum lolos.
export async function POST(
  req: NextRequest,
  { params }: { params: { nama: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const nama = params.nama as StatusFase;
  if (!URUTAN_FASE.includes(nama)) return errorJson("Nama fase tidak dikenal", 400);

  const body = await req.json().catch(() => null as { force?: boolean } | null);
  const force = body?.force === true;

  const all = await getAllFase();
  const target = all.find((f) => f.nama_fase === nama)!;
  const aktifLain = all.find((f) => f.status === "aktif" && f.nama_fase !== nama);

  if (aktifLain) {
    return errorJson(`Fase "${aktifLain.nama_fase}" masih aktif -- tutup dulu sebelum membuka fase lain`, 409);
  }
  if (target.status === "aktif") return errorJson("Fase ini sudah aktif", 409);

  const isReopen = target.status === "ditutup";
  if (isReopen) {
    if (!force) {
      return errorJson(
        "Fase ini sudah pernah ditutup -- membuka ulang adalah skenario darurat, kirim force=true (setelah konfirmasi dua kali di UI)",
        409
      );
    }
  } else {
    const idx = urutanIndex(nama);
    if (idx > 0) {
      const prev = all[idx - 1];
      if (prev.status !== "ditutup") {
        return errorJson(`Fase "${prev.nama_fase}" belum ditutup -- fase harus dibuka berurutan`, 409);
      }
    }
  }

  if (nama === "pemilihan") {
    const faseDb = await getDb("prod");
    const checklist = await faseDb.collection<ChecklistItem>("checklist_gonogo").find({}).toArray();
    const belumLolos = checklist.filter((c) => !c.lolos);
    if (checklist.length === 0 || belumLolos.length > 0) {
      return errorJson(
        "Checklist Go/No-Go belum lolos semua -- fase pemilihan tidak bisa dibuka, tidak ada pengecualian",
        409
      );
    }
    const kandidatAktifCount = await faseDb.collection<Kandidat>("kandidat").countDocuments({ status: "aktif" });
    if (kandidatAktifCount < 2) {
      return errorJson("Minimal 2 kandidat aktif diperlukan sebelum membuka masa pemilihan", 409);
    }
  }

  const db = await getDb("prod");
  const now = new Date();

  if (nama === "sosialisasi") {
    const kandidatAktif = await db
      .collection<Kandidat>("kandidat")
      .find({ status: "aktif" })
      .toArray();
    if (kandidatAktif.length < 2) {
      return errorJson("Minimal 2 kandidat aktif diperlukan sebelum membuka masa sosialisasi", 409);
    }
    await db.collection<KontrolFase>("kontrol_fase").updateOne(
      { nama_fase: nama },
      {
        $set: {
          nama_fase: nama,
          status: "aktif",
          dibuka_at: now,
          ditutup_at: null,
          kandidat_terkunci: kandidatAktif.map((k) => k._id),
        },
      },
      { upsert: true }
    );
  } else {
    await db.collection<KontrolFase>("kontrol_fase").updateOne(
      { nama_fase: nama },
      {
        $set: {
          nama_fase: nama,
          status: "aktif",
          dibuka_at: now,
          ditutup_at: null,
          // Reopen darurat pemilihan (isReopen) berarti voting berjalan lagi --
          // hasil yang sudah terlanjur diumumkan HARUS dicabut otomatis supaya
          // pemilih tidak melihat angka yang sudah tidak final.
          ...(nama === "pemilihan" ? { hasil_diumumkan: false, hasil_diumumkan_at: null } : {}),
        },
      },
      { upsert: true }
    );
  }

  if (nama === "simulasi") {
    await seedSimulasi();
  }

  const updated = await db.collection<KontrolFase>("kontrol_fase").findOne({ nama_fase: nama });
  return NextResponse.json(updated);
}
